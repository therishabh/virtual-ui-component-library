import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiting: ek IP se limited requests. Brute-force, token guessing aur abuse (Google verify /
 * DB pe spam) se bachata hai. Sirf auth routes pe lagao, jo sabse zyada attack hote hain.
 *
 * Limit memory me count hoti hai (single server ke liye theek). Multiple servers hon to shared store
 * (Redis) chahiye, warna har server ki alag count hogi.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minute ka window
    limit: 100,                 // ek IP se max 100 (signup/login/google). Itna isliye: office/NAT ke peeche kai log ek hi IP se aate hain
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

/**
 * /refresh ke liye alag, zyada udaar limiter. Har logged-in user ka browser har ~15 min me ek refresh bhejta hai,
 * to ek office IP ke peeche 50 log hon to ye normal traffic hai. authLimiter ke saath share karte to wo asli users ko block kar deta.
 * Refresh me sirf valid signed token chalta hai, isliye brute-force ka risk waise bhi kam hai; ye limit sirf spam/abuse ke liye hai.
 */
export const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMITED',
        });
    },
});

/**
 * Login pe password guessing (brute-force) rokne ke liye alag, zyada strict limiter.
 *
 * Key = IP + email. Matlab ek IP se ek hi account pe 15 min me max 10 galat attempts.
 * - Sirf IP pe limit lagate to attacker alag-alag emails try karta (credential stuffing) aur limit bach jati,
 *   isliye ye authLimiter (sirf IP) ke SAATH lagta hai, uski jagah nahi.
 * - skipSuccessfulRequests: sahi login count nahi hota, sirf fail hue attempts gine jate hain.
 * - ipKeyGenerator IPv6 users ko /56 subnet me group karta hai, taaki koi IPv6 ke bahut saare addresses se limit bypass na kare.
 * Limitation: kai IPs se ek account pe attack (distributed) isse nahi rukta, uske liye account lockout / CAPTCHA chahiye.
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        return `${ipKeyGenerator(req.ip)}|${email}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            message: 'Too many login attempts, please try again later',
            code: 'RATE_LIMITED',
        });
    },
});

/**
 * Email bhejne wale endpoints (resend verification, forgot password) ke liye. Key = IP + email.
 * Kyu: iske bina koi kisi ke inbox me baar-baar email bhej ke use spam kar sakta hai (email bombing),
 * aur hamare mail provider ka quota/reputation bhi kharab hota hai. Har request count hoti hai (success bhi).
 */
export const emailActionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 ghanta
    limit: 5,                   // ek IP se ek email ke liye ghante me max 5
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        return `${ipKeyGenerator(req.ip)}|${email}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMITED',
        });
    },
});

/**
 * Logged-in user ke sensitive kaam (change password) pe. Key = IP + userId (requireAuth ke BAAD lagana, tabhi req.auth hota hai).
 * Kyu: kisi ka access token chori ho jaye to attacker current password guess karne ki koshish na kar sake.
 */
export const credentialChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${req.auth?.userId ?? ''}`,
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            message: 'Too many attempts, please try again later',
            code: 'RATE_LIMITED',
        });
    },
});
