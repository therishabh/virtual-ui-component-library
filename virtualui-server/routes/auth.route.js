import { Router } from 'express';
// ESM me file extension (.js) likhna zaroori hai, CommonJS jaisa bina extension nahi chalta
import { googleAuth, refresh, logout, logoutAll, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';

// Route file ka kaam sirf URL + HTTP method + middlewares ko controller se jodna hai.
// Business logic yahan nahi, controller/service me rakho. Mount path (/api/auth) app.js me set hai.
const authRouter = Router();

// --- Public routes (login se pehle) ---
// authLimiter: brute-force / abuse rokne ke liye. Middleware order important hai: limiter -> handler.
authRouter.post('/google', authLimiter, googleAuth);   // login / signup
authRouter.post('/refresh', authLimiter, refresh);     // naya access token (refresh token rotation)

// logout public hai (requireAuth nahi): access token expire ho tab bhi user logout kar sake
// POST hai GET nahi: state change karne wale endpoints GET nahi hone chahiye (CSRF / prefetch risk)
authRouter.post('/logout', logout);

// --- Protected routes (requireAuth: valid access token chahiye) ---
authRouter.post('/logout-all', requireAuth, logoutAll);
authRouter.get('/me', requireAuth, me);

export default authRouter;
