import { Router } from 'express';
// ESM me file extension (.js) likhna zaroori hai, CommonJS jaisa bina extension nahi chalta
import {
    signup, login, googleAuth, refresh, logout, logoutAll, me,
    verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { authLimiter, loginLimiter, refreshLimiter, emailActionLimiter, credentialChangeLimiter } from '../middlewares/rateLimit.middleware.js';

// Route file ka kaam sirf URL + HTTP method + middlewares ko controller se jodna hai.
// Business logic yahan nahi, controller/service me rakho. Mount path (/api/auth) app.js me set hai.
const authRouter = Router();

// --- Public routes (login se pehle) ---
// authLimiter: brute-force / abuse rokne ke liye. Middleware order important hai: limiter -> handler.
authRouter.post('/signup', authLimiter, signup);                 // email + password se naya account
authRouter.post('/login', authLimiter, loginLimiter, login);     // email + password login (loginLimiter: brute-force ke liye extra strict)
authRouter.post('/google', authLimiter, googleAuth);   // Google se login / signup

// Email verification: link ka token POST hota hai (GET nahi, email scanners GET links khud khol dete hain)
authRouter.post('/verify-email', authLimiter, verifyEmail);
// emailActionLimiter: koi kisi ke inbox ko spam na kar sake (IP + email pe ghante me 5)
authRouter.post('/resend-verification', authLimiter, emailActionLimiter, resendVerification);

// Password reset (login ke bina, email link se)
authRouter.post('/forgot-password', authLimiter, emailActionLimiter, forgotPassword);
authRouter.post('/reset-password', authLimiter, resetPassword);
authRouter.post('/refresh', refreshLimiter, refresh);     // naya access token (refresh token rotation)

// logout public hai (requireAuth nahi): access token expire ho tab bhi user logout kar sake
// POST hai GET nahi: state change karne wale endpoints GET nahi hone chahiye (CSRF / prefetch risk)
authRouter.post('/logout', logout);

// --- Protected routes (requireAuth: valid access token chahiye) ---
authRouter.post('/logout-all', requireAuth, logoutAll);
// credentialChangeLimiter requireAuth ke BAAD: wo req.auth.userId se key banata hai
authRouter.post('/change-password', requireAuth, credentialChangeLimiter, changePassword);
authRouter.get('/me', requireAuth, me);

export default authRouter;
