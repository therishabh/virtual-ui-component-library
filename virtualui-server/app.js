import express from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.route.js';
import cors from 'cors';
import { env } from './config/env.js';

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

    // CORS: sabse upar, taaki preflight (OPTIONS) request bhi routes/body parser se pehle handle ho jaye.
    // - origin: sirf apna frontend allow karo. env.CLIENT_URL se lete hain taaki dev/prod me alag URL ho sake
    //   (default config/env.js me hai).
    //   Gotcha: origin "" (empty) falsy hota hai, cors usse "*" maan leta hai, aur "*" + credentials browser reject kar deta hai.
    // - credentials: true: httpOnly JWT cookie cross-origin bhejne/lene ke liye zaroori hai.
    //   Client side pe bhi axios me `withCredentials: true` chahiye (Auth.jsx me hai).
    app.use(cors({
        origin: env.CLIENT_URL,
        credentials: true
    }));

    // Global middlewares (order matter karta hai: body parser routes se pehle)
    app.use(express.json());   // JSON body -> req.body
    app.use(cookieParser());   // Cookie header -> req.cookies (JWT yahin se padhenge)

    // Health check: load balancer / uptime monitor ke liye
    app.get('/', (req, res) => {
        res.status(200).json({
            message: "success",
            status: true
        });
    });

    // Routes: /api/auth/* ke saare endpoints authRouter handle karta hai
    app.use('/api/auth', authRouter);

    return app;
};
