import express from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.route.js';

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

    // Global middlewares (order matter karta hai: body parser routes se pehle)
    app.use(express.json());
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

    return app;
};
