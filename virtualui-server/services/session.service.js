import { createHash, randomBytes } from 'node:crypto';
import Session from '../models/session.model.js';
import { generateAccessToken } from '../config/token.js';

// Refresh token / session ki absolute life (30 din). Rotate hone pe bhi extend nahi hoti (model me kyu likha hai)
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Rotation race ka grace window. Do requests ek saath purane refresh token se aayein to dusri ko
// "reuse attack" na samajh ke kill kar de, isliye itne second tak purana token benign maante hain.
const ROTATION_GRACE_MS = 10 * 1000;

// Token ka hash: DB me raw token nahi, hash store hota hai (kyu: models/session.model.js me likha hai).
// Token already 256-bit random hai, isliye yahan bcrypt jaisa slow hash zaruri nahi, SHA-256 kaafi hai.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Crypto-secure random token (guess nahi ho sakta)
const newRefreshToken = () => randomBytes(32).toString('base64url');

/**
 * Login pe naya session banata hai. Return: { accessToken, refreshToken } (dono cookie me jayenge).
 *
 * Refresh token JWT nahi, opaque random hai, kyunki use hamesha DB se compare karna hai (revoke/rotate ke liye),
 * JWT ka "bina DB verify" wala fayda yahan kuch nahi deta.
 */
export const createSession = async (userId, req) => {
    const refreshToken = newRefreshToken();

    const session = await Session.create({
        userId,
        refreshHash: hashToken(refreshToken),
        userAgent: req.get('user-agent'),
        ip: req.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken: generateAccessToken(userId, session._id), refreshToken };
};

/**
 * Refresh token se naya access token (aur naya refresh token) deta hai. Return status:
 *  - 'rotated': normal case, naye access + refresh dono do
 *  - 'grace'  : race (dusra tab/request pehle rotate kar chuka), sirf naya access token do,
 *               refresh cookie touch mat karo (pehli response ki Set-Cookie wahi set kar degi)
 *  - 'invalid': token galat / expire / reuse detect hua => 401
 *
 * Rotation kyu: har refresh pe token badal jata hai, to chori hua refresh token ek baar use hote hi purana ho jata hai.
 * Chor aur asli user me se jo bhi purana token dobara bheje, hume pata chal jata hai (reuse detection).
 */
export const rotateSession = async (refreshToken) => {
    if (typeof refreshToken !== 'string' || !refreshToken) return { status: 'invalid' };

    const now = new Date();
    const oldHash = hashToken(refreshToken);
    const nextToken = newRefreshToken();

    // Atomic update (find + update ek hi step me): do requests ek saath aayein to sirf ek jeetegi,
    // dusri ko null milega. Read-then-write karte to dono rotate kar dete.
    const session = await Session.findOneAndUpdate(
        { refreshHash: oldHash, expiresAt: { $gt: now } },
        { $set: { refreshHash: hashToken(nextToken), prevRefreshHash: oldHash, rotatedAt: now } },
    ); // default me update se PEHLE ka doc deta hai, humein sirf _id/userId chahiye

    if (session) {
        return {
            status: 'rotated',
            userId: session.userId,
            accessToken: generateAccessToken(session.userId, session._id),
            refreshToken: nextToken,
        };
    }

    // Current token nahi mila: shayad ye PURANA (already rotate ho chuka) token hai
    const reused = await Session.findOne({ prevRefreshHash: oldHash, expiresAt: { $gt: now } });
    if (!reused) return { status: 'invalid' };

    if (now - reused.rotatedAt < ROTATION_GRACE_MS) {
        return { status: 'grace', userId: reused.userId, accessToken: generateAccessToken(reused.userId, reused._id) };
    }

    // Grace ke baad purana token aaya = replay / chori. Poora session kill, asli user ko dobara login karna padega
    await reused.deleteOne();
    return { status: 'invalid' };
};

// isAuth ke liye: access token ke sid wala session abhi bhi DB me hai (logout/revoke/expire nahi hua)?
// Ye check isliye ki logout ke baad access token ke bache hue 15 min me bhi request fail ho jaye.
export const isSessionActive = async (sessionId) => {
    return Boolean(await Session.exists({ _id: sessionId, expiresAt: { $gt: new Date() } }));
};

// Logout: session row hata do => refresh token + access token dono kisi bhi browser me kaam nahi karenge
export const deleteSessionByRefreshToken = async (refreshToken) => {
    if (typeof refreshToken !== 'string' || !refreshToken) return;
    await Session.deleteOne({ refreshHash: hashToken(refreshToken) });
};

export const deleteSessionById = async (sessionId) => {
    if (!sessionId) return;
    await Session.deleteOne({ _id: sessionId });
};
