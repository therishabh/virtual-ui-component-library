import User from '../models/user.model.js';
import { verifyGoogleIdToken } from '../config/google.js';
import { issueSession, rotateSession, revokeSessionByToken, revokeAllUserSessions } from '../services/session.service.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Controller ka kaam: HTTP request padho -> service/model ko bulao -> HTTP response banao.
 * Security/DB ka heavy logic services/ me rehta hai (controller patla rakho).
 *
 * Errors: `throw new ApiError(status, msg)` karo, central error middleware response bana dega.
 * (Express 5 me async handler ka throw automatically wahan pahunchta hai.)
 */

// Client ko sirf wahi fields do jo uske kaam ke hain. Poora DB document kabhi seedha return mat karo
// (aage koi internal/sensitive field add ho jaye to galti se leak na ho, jaise googleId).
const toPublicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    aiCredits: user.aiCredits,
});

// Session record me kis device/IP se login hua, wo store karne ke liye
const getMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

/**
 * POST /api/auth/google    body: { idToken }
 *
 * Flow: Google ID token verify -> user find/create -> access + refresh tokens (cookies) -> response.
 */
export const googleAuth = async (req, res) => {
    // 1) Validation: type check zaroori hai (object aaya to NoSQL injection / library crash ka risk)
    const { idToken } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
        throw new ApiError(400, 'idToken is required', 'VALIDATION_ERROR');
    }

    // 2) Google se verify. Fail hone pe detail client ko mat batao (attacker ko hint milta hai): generic 401
    let profile;
    try {
        profile = await verifyGoogleIdToken(idToken);
    } catch {
        throw new ApiError(401, 'Invalid Google token', 'INVALID_GOOGLE_TOKEN');
    }

    // Unverified email pe account bana/link kar diya to koi kisi aur ka email claim karke account hijack kar sakta hai
    if (!profile.emailVerified) {
        throw new ApiError(401, 'Google email is not verified', 'EMAIL_NOT_VERIFIED');
    }

    // 3) Find-or-create. Email ko normalize karo (lowercase), taaki duplicate users na bane
    const email = profile.email.trim().toLowerCase();
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
        try {
            user = await User.create({ name: profile.name.trim(), email, googleId: profile.googleId });
            isNewUser = true;
        } catch (error) {
            // Race condition: do requests ek saath aayein to dono "user nahi mila" dekhte hain, ek create hota hai
            // aur doosra unique index pe E11000 (duplicate key) se fail. Us case me jo user ban chuka hai use fetch karo.
            if (error.code !== 11000) throw error;
            user = await User.findOne({ email });
        }
    }

    // Account linking: pehle se email se bana user (googleId nahi) ho to Google id attach karo.
    // Agar googleId already alag hai to ye wo account nahi, reject karo.
    if (!user.googleId) {
        user.googleId = profile.googleId;
        await user.save();
    } else if (user.googleId !== profile.googleId) {
        throw new ApiError(401, 'Google account mismatch', 'GOOGLE_ACCOUNT_MISMATCH');
    }

    // 4) Naya session: access (15 min) + refresh (7 din) tokens, dono httpOnly cookies me
    const tokens = await issueSession(user, getMeta(req));
    setAuthCookies(res, tokens);

    // 5) Naya user = 201 Created, existing = 200 OK
    return res.status(isNewUser ? 201 : 200).json({
        status: true,
        message: isNewUser ? 'User created successfully' : 'Login successful',
        data: toPublicUser(user),
    });
};

/**
 * POST /api/auth/refresh
 *
 * Access token expire hone pe frontend (TOKEN_EXPIRED code dekh ke) ye call karta hai.
 * Refresh cookie se naya access + naya refresh token milta hai (ROTATION), purana refresh token revoke ho jata hai.
 */
export const refresh = async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new ApiError(401, 'Refresh token missing', 'NO_REFRESH_TOKEN');

    try {
        const { user, ...tokens } = await rotateSession(refreshToken, getMeta(req));
        setAuthCookies(res, tokens);
        return res.status(200).json({ status: true, message: 'Token refreshed', data: toPublicUser(user) });
    } catch (error) {
        // Session invalid / reuse pakda gaya: browser me bachi hui (ab bekaar) cookies bhi hata do
        if (error instanceof ApiError && error.status === 401) clearAuthCookies(res);
        throw error;
    }
};

/**
 * POST /api/auth/logout
 *
 * Asli logout: DB me session revoke (refresh token ab kabhi kaam nahi karega) + cookies clear.
 * requireAuth nahi lagaya: access token expire ho chuka ho tab bhi user logout kar sake.
 * Hamesha 200 (idempotent): pehle se logout ho to bhi error nahi.
 */
export const logout = async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) await revokeSessionByToken(refreshToken);

    clearAuthCookies(res);
    return res.status(200).json({ status: true, message: 'Logout successful' });
};

/**
 * POST /api/auth/logout-all      (requireAuth ke saath)
 *
 * Saare devices se logout: user ke saare active sessions revoke. Password/account compromise ho to kaam aata hai.
 * Note: already issue ho chuke access tokens max 15 min tak chalenge (stateless hain), phir sab band.
 */
export const logoutAll = async (req, res) => {
    await revokeAllUserSessions(req.auth.userId);

    clearAuthCookies(res);
    return res.status(200).json({ status: true, message: 'Logged out from all devices' });
};

/**
 * GET /api/auth/me      (requireAuth ke saath)
 *
 * Current user ka profile. Frontend app load pe isse pata karta hai ki user logged in hai ya nahi.
 * Yahan DB se fresh data padhte hain (token ka role/data purana ho sakta hai, jaise aiCredits).
 */
export const me = async (req, res) => {
    const user = await User.findById(req.auth.userId);
    if (!user) throw new ApiError(401, 'User no longer exists', 'USER_NOT_FOUND');

    return res.status(200).json({ status: true, data: toPublicUser(user) });
};
