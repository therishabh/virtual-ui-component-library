import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRouter from './routes/auth.route.js';
import env from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * Express app factory.
 *
 * - Sirf app configure karke return karta hai. listen() yahan nahi hota, wo server.js ka kaam hai.
 * - Fayda: tests me bina port khole app import kar sakte hain (supertest(createApp())), aur
 *   har test ko fresh app mil sakta hai.
 * - DB connect bhi yahan nahi hota, wo bhi server.js me hota hai. App ko DB se alag rakhne se testing aasan hoti hai.
 */
export const createApp = () => {
    const app = express();

    // Express ka "X-Powered-By: Express" header band: attacker ko framework batane ki zarurat nahi
    app.disable('x-powered-by');

    // Reverse proxy (nginx / load balancer) ke peeche ho to req.ip asli client IP se aaye, proxy ki IP se nahi.
    // Iske bina rate limiting sabko ek IP samajh ke sabko block kar deti hai. Sahi number set karo (galat value spoofing deti hai).
    if (env.TRUST_PROXY !== undefined) app.set('trust proxy', env.TRUST_PROXY);

    // CORS: browser frontend (alag origin/port) se cookies ke saath requests tabhi allow karta hai jab server bole.
    // - origin: sirf hamara frontend (allowlist). "*" cookies ke saath chalta hi nahi, aur unsafe bhi hai
    // - credentials: true: cookies (accessToken/refreshToken) cross-origin requests me jane do
    app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

    // Global middlewares (order matter karta hai: body parser routes se pehle)
    app.use(express.json({ limit: '10kb' })); // body size limit: bade payload se memory abuse na ho
    app.use(cookieParser());

    // Health check: load balancer / uptime monitor ke liye
    app.get('/', (req, res) => {
        res.status(200).json({
            message: "success",
            status: true
        });
    });

    // Routes
    app.use('/api/auth', authRouter);

    // Error handling HAMESHA sabse last me: pehle 404 (koi route match nahi hua), phir central error handler
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
};
