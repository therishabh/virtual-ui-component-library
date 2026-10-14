import { verifyAccessToken } from '../config/token.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Authentication: "tum kaun ho?" Protected routes ke aage lagao: router.get('/me', requireAuth, handler)
 *
 * Access token cookie se padhta hai, verify karta hai, aur `req.auth` set karta hai.
 * DB hit nahi hota (token stateless hai), isliye har request pe fast.
 *
 * Status codes (galat code mat do):
 *  - 401 Unauthorized : tum authenticated nahi ho (token missing / invalid / expired)
 *  - 403 Forbidden    : tum authenticated ho, par is kaam ki permission nahi hai (requireRole)
 */
export const requireAuth = (req, res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new ApiError(401, 'Authentication required', 'NO_TOKEN');

    try {
        const payload = verifyAccessToken(token);
        req.auth = { userId: payload.sub, role: payload.role, tokenId: payload.jti };
        next();
    } catch (error) {
        // Expired ko alag code do: frontend ye dekh ke /refresh call karke request retry karega
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Access token expired', 'TOKEN_EXPIRED');
        }
        throw new ApiError(401, 'Invalid access token', 'INVALID_TOKEN');
    }
};

/**
 * Authorization: "tumhe is kaam ki permission hai?" Hamesha requireAuth ke BAAD lagao.
 * Usage: router.delete('/users/:id', requireAuth, requireRole('ADMIN'), handler)
 *
 * Ye factory hai (function return karta hai) taaki alag-alag routes pe alag roles pass kar sako.
 */
export const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.auth) throw new ApiError(401, 'Authentication required', 'NO_TOKEN');
    if (!allowedRoles.includes(req.auth.role)) {
        throw new ApiError(403, 'You do not have permission to do this', 'FORBIDDEN');
    }
    next();
};
