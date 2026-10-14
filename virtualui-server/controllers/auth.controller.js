import User from '../models/user.model.js';
import { verifyGoogleIdToken } from '../config/google.js';
import { issueSession, rotateSession, revokeSessionByToken, revokeAllUserSessions } from '../services/session.service.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';
import { ApiError } from '../utils/ApiError.js';
import { EMAIL_TOKEN_TYPES } from '../models/emailToken.model.js';
import { createEmailToken, consumeEmailToken, deleteUserEmailTokens } from '../services/emailToken.service.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/mail.service.js';
import {
    hashPassword, verifyPassword, verifyAgainstDummy, needsRehash,
    PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH,
} from '../services/password.service.js';

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
    emailVerified: user.emailVerified,
});

// Session record me kis device/IP se login hua, wo store karne ke liye
const getMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Login/signup ke liye email ko ek standard form me lao (lowercase, trim), taaki "A@x.com" aur "a@x.com" ek hi account ho
const normalizeEmail = (email) => email.trim().toLowerCase();

// Password rules ek jagah (signup aur reset/change teeno me same). Password ko trim NAHI karte:
// user ne spaces daale hain to wo password ka hissa hain.
const assertValidPassword = (password) => {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        throw new ApiError(
            400,
            `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
            'VALIDATION_ERROR',
        );
    }
};

const assertValidEmail = (email) => {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        throw new ApiError(400, 'A valid email is required', 'VALIDATION_ERROR');
    }
};

/**
 * Email bhejna "best effort" hai: mail fail ho (provider down, config nahi) to bhi signup/forgot ka flow nahi tootna chahiye
 * aur client ko pata nahi chalna chahiye (wo email existence leak karta). Error sirf server log me jata hai.
 * User "resend" se dobara maang sakta hai.
 */
const sendSafely = async (label, task) => {
    try {
        await task();
    } catch (error) {
        console.error(`[mail] ${label} failed:`, error.message);
    }
};

/**
 * Kaam response ke BAAD (background me) chalao, uska intezar mat karo.
 * Kyu: forgot-password / resend me "email exist karta hai" wale case me DB write + mail ka extra time lagta hai.
 * Agar hum wait karein to response time se attacker pata laga leta hai ki email registered hai (timing leak).
 * Background me chalane se dono cases me response time barabar rehta hai.
 * (Production me asli mail provider ke saath ye kaam queue (BullMQ etc.) me jana chahiye.)
 */
const runInBackground = (label, task) => {
    task().catch((error) => console.error(`[background] ${label} failed:`, error.message));
};

const issueVerificationEmail = (user) =>
    sendSafely('verification email', async () => {
        const token = await createEmailToken(user._id, EMAIL_TOKEN_TYPES.VERIFY_EMAIL);
        await sendVerificationEmail({ to: user.email, name: user.name, token });
    });

const issueResetEmail = (user) =>
    sendSafely('password reset email', async () => {
        const token = await createEmailToken(user._id, EMAIL_TOKEN_TYPES.RESET_PASSWORD);
        await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    });

/**
 * POST /api/auth/signup    body: { name, email, password }
 *
 * Email + password se naya account. Google se alag ek aur tareeka: ek user dono se aa sakta hai.
 *
 * IMPORTANT: signup ke baad user login NAHI hota (cookies nahi milti). Pehle email verify karni padti hai:
 * verification link email me jata hai (abhi console me print hota hai), link kholne ke baad hi login chalta hai.
 * Isse koi kisi aur ka email use karke account nahi bana ke use karta reh sakta.
 */
export const signup = async (req, res) => {
    const { name, email, password } = req.body ?? {};

    // 1) Validation. typeof check pehle: object/array aaya to NoSQL injection ya library crash ka risk
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        throw new ApiError(400, 'Name is required (max 100 characters)', 'VALIDATION_ERROR');
    }
    assertValidEmail(email);
    assertValidPassword(password);

    // 2) Hash karke hi store karo. Plain password kahin save/log nahi hota
    const passwordHash = await hashPassword(password);

    // 3) User banao. Pehle findOne karke check nahi karte, seedha create: unique index duplicate pakad leta hai
    // (findOne + create me race condition hoti hai, do requests ek saath aayein to dono pass ho jati).
    let user;
    try {
        user = await User.create({
            name: name.trim(),
            email: normalizeEmail(email),
            passwordHash,
            emailVerified: false,
        });
    } catch (error) {
        // Email pehle se hai (password se bana ho ya Google se, dono me). Existing account ko kabhi touch/link nahi karte:
        // agar Google-only account pe signup se password set ho jata to koi bhi kisi ke Google account me password jod deta.
        // (Agar user ne verification email miss kar di thi to wo /resend-verification se naya link le sakta hai.)
        if (error.code === 11000) {
            throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
        }
        throw error;
    }

    // 4) Verification email (abhi console pe link print hoga). Fail bhi ho to signup successful rehta hai
    await issueVerificationEmail(user);

    // 5) Koi cookie/token nahi: verify hone tak login nahi
    return res.status(201).json({
        status: true,
        message: 'Account created. Please verify your email to sign in',
        data: toPublicUser(user),
    });
};

/**
 * POST /api/auth/verify-email    body: { token }
 *
 * Email ke link me jo token tha wo yahan aata hai. Frontend page URL se token padhta hai aur is endpoint ko POST karta hai.
 * (GET nahi: email security scanners / link previews links ko khud khol dete hain, GET pe verify hota to
 * user ke click kiye bina hi verify ho jata. POST pe ye nahi hota.)
 *
 * Verify ke baad auto-login NAHI karte: link forward/leak ho jaye to bhi koi bina password ke andar nahi aa sakta.
 */
export const verifyEmail = async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== 'string' || !token) {
        throw new ApiError(400, 'Token is required', 'VALIDATION_ERROR');
    }

    // Token ek baar hi chalta hai (consume). Invalid / expired / pehle use ho chuka: sab ke liye ek jaisa error
    const userId = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.VERIFY_EMAIL);
    if (!userId) {
        throw new ApiError(400, 'Invalid or expired verification link', 'INVALID_TOKEN');
    }

    await User.updateOne({ _id: userId }, { $set: { emailVerified: true } });

    return res.status(200).json({ status: true, message: 'Email verified. You can sign in now' });
};

/**
 * POST /api/auth/resend-verification    body: { email }
 *
 * Verification email dobara bhejta hai (purana link band, naya chalega). HAMESHA ek jaisa 200 response:
 * email registered ho ya na ho, verified ho ya na ho. Warna ye endpoint "kaunsa email registered hai" batane ka zariya ban jata.
 */
export const resendVerification = async (req, res) => {
    const { email } = req.body ?? {};
    assertValidEmail(email);

    runInBackground('resend verification', async () => {
        const user = await User.findOne({ email: normalizeEmail(email) });
        if (user && !user.emailVerified) await issueVerificationEmail(user);
    });

    return res.status(200).json({
        status: true,
        message: 'If this email needs verification, a new link has been sent',
    });
};

/**
 * POST /api/auth/forgot-password    body: { email }
 *
 * Password reset link email karta hai. Resend ki tarah HAMESHA ek jaisa 200 (email enumeration nahi, timing nahi).
 * Google-only account ke liye bhi link jata hai: wahi uska tareeka hai password set karne ka (email ka malik hona hi proof hai).
 */
export const forgotPassword = async (req, res) => {
    const { email } = req.body ?? {};
    assertValidEmail(email);

    runInBackground('forgot password', async () => {
        const user = await User.findOne({ email: normalizeEmail(email) });
        if (user) await issueResetEmail(user);
    });

    return res.status(200).json({
        status: true,
        message: 'If an account exists for this email, a reset link has been sent',
    });
};

/**
 * POST /api/auth/reset-password    body: { token, password }
 *
 * Email ke reset link se naya password set karta hai. Login nahi karata (user ko ab login karna hoga).
 *
 * Ye karta hai:
 *  1. Naya password validate + hash (token consume karne se PEHLE: password galat ho to token waste na ho)
 *  2. Token consume (ek baar)
 *  3. Password set + emailVerified true (reset link email ke inbox me gaya tha, matlab malik ne hi kholi)
 *  4. User ke baaki email tokens delete
 *  5. SAARE sessions revoke: koi (attacker bhi) pehle se logged-in ho to ab nikal jaye. Password isi liye to badla jata hai
 */
export const resetPassword = async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || !token) {
        throw new ApiError(400, 'Token is required', 'VALIDATION_ERROR');
    }
    assertValidPassword(password);

    const passwordHash = await hashPassword(password);

    const userId = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.RESET_PASSWORD);
    if (!userId) {
        throw new ApiError(400, 'Invalid or expired reset link', 'INVALID_TOKEN');
    }

    await User.updateOne({ _id: userId }, { $set: { passwordHash, emailVerified: true } });
    await deleteUserEmailTokens(userId);
    await revokeAllUserSessions(userId);

    // Is browser me bachi hui purani cookies bhi hata do
    clearAuthCookies(res);
    return res.status(200).json({ status: true, message: 'Password updated. Please sign in with your new password' });
};

/**
 * POST /api/auth/change-password    (requireAuth)    body: { currentPassword, newPassword }
 *
 * Logged-in user password badalta hai. Current password maangte hain: kisi ka access token chori ho jaye
 * to bhi attacker bina purane password ke password nahi badal sakta.
 *
 * Badalne ke baad: baaki SAARE devices ke sessions revoke, is device ke liye naya session. (Isi device pe user logged in rehta hai.)
 * Google-only account (password nahi) ke liye ye nahi chalta: unhe "forgot password" se pehla password set karna hota hai.
 */
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
        throw new ApiError(400, 'Current password is required', 'VALIDATION_ERROR');
    }
    assertValidPassword(newPassword);

    const user = await User.findById(req.auth.userId).select('+passwordHash');
    if (!user) throw new ApiError(401, 'User no longer exists', 'USER_NOT_FOUND');

    if (!user.passwordHash) {
        throw new ApiError(400, 'No password set for this account. Use "forgot password" to set one', 'NO_PASSWORD_SET');
    }

    // currentPassword max length check: bahut lamba string bhejke hashing me CPU na khaye
    if (currentPassword.length > PASSWORD_MAX_LENGTH || !(await verifyPassword(user.passwordHash, currentPassword))) {
        throw new ApiError(400, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }
    if (newPassword === currentPassword) {
        throw new ApiError(400, 'New password must be different from the current one', 'SAME_PASSWORD');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await revokeAllUserSessions(user._id);
    const tokens = await issueSession(user, getMeta(req));
    setAuthCookies(res, tokens);

    return res.status(200).json({ status: true, message: 'Password changed. Other devices have been signed out' });
};

/**
 * POST /api/auth/login    body: { email, password }
 *
 * Email + password login. Security ke rules yahan follow hote hain:
 *  1. Galat email aur galat password pe EK JAISA error (user enumeration nahi: attacker ko pata na chale email registered hai ya nahi)
 *  2. Dono cases me lagbhag same time (email na mile tab bhi dummy hash verify chalta hai)
 *  3. Brute-force: route pe loginLimiter lagta hai (routes/auth.route.js)
 *  4. Email verify hone par hi login (403 EMAIL_NOT_VERIFIED). Ye check password sahi hone ke BAAD hota hai,
 *     taaki galat password wale ko ye pata na chale ki account verified hai ya nahi.
 */
export const login = async (req, res) => {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        throw new ApiError(400, 'Email and password are required', 'VALIDATION_ERROR');
    }
    // Bahut lamba password: hash karne me CPU kharch hoga (DoS). Sahi password itna lamba ho hi nahi sakta
    if (password.length > PASSWORD_MAX_LENGTH) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // passwordHash select:false hai, isliye explicitly mangte hain
    const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');

    // Google-only user ke paas passwordHash nahi hota: usse bhi "galat password" ki tarah treat karo
    let isValid = false;
    if (user?.passwordHash) {
        isValid = await verifyPassword(user.passwordHash, password);
    } else {
        await verifyAgainstDummy(password); // timing barabar rakhne ke liye
    }

    // Ek hi message, har failure ke liye (email nahi mila / password galat / Google-only account)
    if (!isValid) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Password sahi hai, par email verify nahi hui: login nahi. Frontend "resend verification" ka option dikhaye
    if (!user.emailVerified) {
        throw new ApiError(403, 'Please verify your email before signing in', 'EMAIL_NOT_VERIFIED');
    }

    // Hash ke parameters purane ho gaye hon to ab (plain password hamare paas hai) naye params se dobara hash karo
    if (needsRehash(user.passwordHash)) {
        user.passwordHash = await hashPassword(password);
        await user.save();
    }

    const tokens = await issueSession(user, getMeta(req));
    setAuthCookies(res, tokens);

    return res.status(200).json({
        status: true,
        message: 'Login successful',
        data: toPublicUser(user),
    });
};

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
        throw new ApiError(401, 'Google email is not verified', 'GOOGLE_EMAIL_NOT_VERIFIED'); // alag code: password login ka EMAIL_NOT_VERIFIED (403) frontend pe "resend" button dikhata hai, ye nahi
    }

    // 3) Find-or-create. Email ko normalize karo (lowercase), taaki duplicate users na bane
    const email = profile.email.trim().toLowerCase();
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
        try {
            user = await User.create({ name: profile.name.trim(), email, googleId: profile.googleId, emailVerified: true });
            isNewUser = true;
        } catch (error) {
            // Race condition: do requests ek saath aayein to dono "user nahi mila" dekhte hain, ek create hota hai
            // aur doosra unique index pe E11000 (duplicate key) se fail. Us case me jo user ban chuka hai use fetch karo.
            if (error.code !== 11000) throw error;
            user = await User.findOne({ email });
        }
    }

    // Account linking: email se pehle bana (password wala) account ho aur googleId nahi, to Google id attach karo.
    // Agar googleId already alag hai to ye wo account nahi, reject karo.
    if (!user.googleId) {
        // PRE-HIJACKING se bachav: password signup me email verify nahi hota. Attacker kisi ka email (victim@gmail.com)
        // apne password ke saath register kar sakta hai. Baad me victim Google se login kare aur hum account link kar dein,
        // to attacker ka password us account me chalta rahega. Isliye unverified account link hone pe uska password
        // hata dete hain aur uske saare purane sessions (attacker ke bhi) revoke karte hain.
        if (!user.emailVerified) {
            user.set('passwordHash', undefined);
            await revokeAllUserSessions(user._id);
        }
        user.googleId = profile.googleId;
        user.emailVerified = true; // Google ne email verify kiya hai
        await user.save();
        await deleteUserEmailTokens(user._id); // purane verify/reset links ab bekaar, hata do
    } else if (user.googleId !== profile.googleId) {
        throw new ApiError(401, 'Google account mismatch', 'GOOGLE_ACCOUNT_MISMATCH');
    } else if (!user.emailVerified) {
        // Is feature se pehle bane Google users ke paas emailVerified field nahi tha, use sahi kar do
        user.emailVerified = true;
        await user.save();
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
