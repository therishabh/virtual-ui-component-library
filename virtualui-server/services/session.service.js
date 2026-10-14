import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import Session from '../models/session.model.js';
import User from '../models/user.model.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/token.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Session service: refresh token ka poora lifecycle (issue -> rotate -> revoke).
 * Controller sirf HTTP (cookie, response) sambhalta hai, DB/security logic yahan rehta hai.
 */

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Hash compare constant-time me: normal === se timing attack ka (chhota) risk hota hai
const safeEqual = (a, b) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const unauthorized = () => new ApiError(401, 'Invalid or expired session');

/**
 * Naya access + refresh token pair banao aur refresh token ka record DB me save karo.
 * `family` login pe naya banta hai, rotation me wahi purani family aati hai.
 */
export const issueSession = async (user, { userAgent, ip } = {}, family = randomUUID()) => {
    const accessToken = signAccessToken({ userId: user._id, role: user.role });
    const { token: refreshToken, jti, expiresAt } = signRefreshToken({ userId: user._id });

    await Session.create({
        user: user._id,
        jti,
        family,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent,
        ip,
    });

    return { accessToken, refreshToken, jti };
};

// Poori family revoke: jo tokens abhi active hain unhe revoked mark karo
const revokeFamily = (family) =>
    Session.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } });

/**
 * Refresh token se naya pair do (ROTATION) aur purana invalidate karo.
 *
 * Steps:
 *  1. JWT verify (signature, expiry, issuer, audience)
 *  2. DB me record dhundo aur hash match karo
 *  3. REUSE DETECTION: record pehle se revoked hai => ye token pehle use ho chuka hai, ab koi dobara
 *     bhej raha hai. Matlab token chori hua hai (ya attacker aur asli user dono use kar rahe hain).
 *     Poori family revoke karo, dono ko dobara login karna padega.
 *  4. Purana token atomically revoke karo (do parallel requests me sirf ek jeete)
 *  5. Naya pair issue karo (same family)
 */
export const rotateSession = async (refreshToken, meta) => {
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw unauthorized();
    }

    const session = await Session.findOne({ jti: payload.jti });
    if (!session || !safeEqual(session.tokenHash, hashToken(refreshToken))) {
        throw unauthorized();
    }

    if (session.revokedAt) {
        await revokeFamily(session.family);
        throw unauthorized();
    }

    // Atomic claim: filter me `revokedAt: null` hai, to sirf wahi request update karegi jo pehle pahunchi.
    // Doosri ko modifiedCount 0 milega => use bhi reuse maano.
    const claimed = await Session.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );
    if (claimed.modifiedCount !== 1) {
        await revokeFamily(session.family);
        throw unauthorized();
    }

    // User delete ho chuka ho to session bhi bekaar
    const user = await User.findById(session.user);
    if (!user) {
        await revokeFamily(session.family);
        throw unauthorized();
    }

    const next = await issueSession(user, meta, session.family);
    await Session.updateOne({ _id: session._id }, { $set: { replacedBy: next.jti } });

    return { ...next, user };
};

/**
 * Logout: ek device ka session revoke (us login ki poori family, taaki rotation ke baad ka naya token bhi na chale).
 * Token invalid/missing ho to chupchap ignore: logout hamesha successful hona chahiye (idempotent).
 */
export const revokeSessionByToken = async (refreshToken) => {
    try {
        const { jti } = verifyRefreshToken(refreshToken);
        const session = await Session.findOne({ jti });
        if (session) await revokeFamily(session.family);
    } catch {
        // invalid / expired token: kuch revoke karne ko nahi
    }
};

/** "Logout from all devices": user ke saare active sessions revoke. */
export const revokeAllUserSessions = (userId) =>
    Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
