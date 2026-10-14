import rateLimit from 'express-rate-limit';

/**
 * Rate limiting: ek IP se limited requests. Brute-force, token guessing aur abuse (Google verify /
 * DB pe spam) se bachata hai. Sirf auth routes pe lagao, jo sabse zyada attack hote hain.
 *
 * Limit memory me count hoti hai (single server ke liye theek). Multiple servers hon to shared store
 * (Redis) chahiye, warna har server ki alag count hogi.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minute ka window
    limit: 30,                  // is window me ek IP se max 30 requests
    standardHeaders: 'draft-8', // RateLimit-* headers bhejo, taaki client ko pata chale kitni limit bachi
    legacyHeaders: false,       // purane X-RateLimit-* headers band
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMITED',
        });
    },
});
