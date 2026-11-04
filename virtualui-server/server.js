// env.js andar se dotenv load karta hai aur required vars validate karta hai
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import connectToDb, { disconnectDb } from './config/db.js';

const PORT = env.PORT;

/**
 * Entry point: DB connect -> server listen -> graceful shutdown handlers.
 * Express app banana app.js ka kaam hai, yahan sirf process lifecycle handle hoti hai.
 */
const startServer = async () => {
    // Pehle DB, phir listen: DB ke bina server traffic lena shuru na kare
    await connectToDb();

    const app = createApp();
    const server = app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}, http://localhost:${PORT}`);
    });

    // Graceful shutdown: pehle naye connections lena band karo, chal rahi requests poori hone do,
    // phir DB close karke exit. Seedha process.exit karne se in-flight requests beech me kat jati hain.
    let isShuttingDown = false;
    const shutdown = async (signal, exitCode = 0) => {
        if (isShuttingDown) return; // signal dobara aaye (jaise Ctrl+C do baar) to ignore
        isShuttingDown = true;
        logger.info(`${signal} received, shutting down...`);

        // Safety net: agar koi connection hang ho jaye to 10s baad force exit.
        // unref() isliye ki ye timer khud process ko zinda na rakhe.
        setTimeout(() => {
            logger.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10_000).unref();

        try {
            // server.close callback tab chalta hai jab saare connections band ho jayein
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
                server.closeIdleConnections(); // keep-alive wale idle connections turant band karo, warna close ruka rehta hai
            });
            await disconnectDb();
            logger.info('Shutdown complete');
            process.exit(exitCode);
        } catch (err) {
            logger.error({ err }, 'Error during shutdown');
            process.exit(1);
        }
    };

    // SIGINT = Ctrl+C, SIGTERM = Docker/k8s/pm2 stop karte time bhejte hain
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Unhandled errors me process ka state bharosemand nahi rehta: log karo, cleanly band karo, non-zero exit code do.
    // `fatal` level isliye: process ab band hone wala hai, alerting me ye sabse upar dikhna chahiye.
    // `reason` Error na bhi ho sakta hai (koi bhi value reject ho sakti hai), pino dono handle kar leta hai.
    process.on('unhandledRejection', (reason) => {
        logger.fatal({ err: reason }, 'Unhandled rejection');
        shutdown('unhandledRejection', 1);
    });
    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught exception');
        shutdown('uncaughtException', 1);
    });
};

try {
    await startServer();
} catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
}
