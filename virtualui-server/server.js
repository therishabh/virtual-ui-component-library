// dotenv sabse pehle import hota hai, taaki .env baaki modules se pehle load ho jaye
import 'dotenv/config';
import { createApp } from './app.js';
import connectToDb, { disconnectDb } from './config/db.js';

const PORT = process.env.PORT || 8000;

/**
 * Entry point: DB connect -> server listen -> graceful shutdown handlers.
 * Express app banana app.js ka kaam hai, yahan sirf process lifecycle handle hoti hai.
 */
const startServer = async () => {
    // Pehle DB, phir listen: DB ke bina server traffic lena shuru na kare
    await connectToDb();

    const app = createApp();
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port : ${PORT}, http://localhost:${PORT}`);
    });

    // Graceful shutdown: pehle naye connections lena band karo, chal rahi requests poori hone do,
    // phir DB close karke exit. Seedha process.exit karne se in-flight requests beech me kat jati hain.
    let isShuttingDown = false;
    const shutdown = async (signal, exitCode = 0) => {
        if (isShuttingDown) return; // signal dobara aaye (jaise Ctrl+C do baar) to ignore
        isShuttingDown = true;
        console.log(`${signal} received, shutting down...`);

        // Safety net: agar koi connection hang ho jaye to 10s baad force exit.
        // unref() isliye ki ye timer khud process ko zinda na rakhe.
        setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10_000).unref();

        try {
            // server.close callback tab chalta hai jab saare connections band ho jayein
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
                server.closeIdleConnections(); // keep-alive wale idle connections turant band karo, warna close ruka rehta hai
            });
            await disconnectDb();
            console.log('Shutdown complete');
            process.exit(exitCode);
        } catch (err) {
            console.error('Error during shutdown:', err.message);
            process.exit(1);
        }
    };

    // SIGINT = Ctrl+C, SIGTERM = Docker/k8s/pm2 stop karte time bhejte hain
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Unhandled errors me process ka state bharosemand nahi rehta: log karo, cleanly band karo, non-zero exit code do
    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled rejection:', reason);
        shutdown('unhandledRejection', 1);
    });
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        shutdown('uncaughtException', 1);
    });
};

try {
    await startServer();
} catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
}
