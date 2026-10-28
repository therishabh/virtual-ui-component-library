import { createHash, randomBytes } from 'node:crypto';
import Session from '../models/session.model.js';

// Session kitne time tak valid rahegi (7 din). Cookie ka maxAge bhi isi se set hota hai, taaki dono sync rahein
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Token ka hash: DB me raw token nahi, hash store hota hai (kyu: models/session.model.js me likha hai).
// Token already 256-bit random hai, isliye yahan bcrypt jaisa slow hash zaruri nahi, SHA-256 kaafi hai.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Naya session banata hai aur cookie me dene ke liye RAW token return karta hai.
 *
 * Token = crypto-secure random 32 bytes (guess nahi ho sakta). JWT ki jagah opaque token isliye:
 * ab har request pe DB check karna hi hai (revoke karne ke liye), to JWT ka "bina DB ke verify" wala
 * fayda khatam ho jata hai, aur JWT me secret leak / algorithm confusion jaise risks bhi nahi rehte.
 */
export const createSession = async (userId, req) => {
    const token = randomBytes(32).toString('base64url');

    await Session.create({
        userId,
        tokenHash: hashToken(token),
        userAgent: req.get('user-agent'),
        ip: req.ip,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return token;
};

// Valid session dhundta hai. Cookie copy karke dusre browser me daalo to ye token chalega (hijack ka risk
// poori tarah khatam nahi hota), lekin logout / revoke ke baad session row nahi milegi => null.
export const findValidSession = async (token) => {
    if (typeof token !== 'string' || !token) return null;

    // expiresAt khud check karte hain, kyunki TTL index delete karne me ~60 sec late ho sakta hai
    return Session.findOne({
        tokenHash: hashToken(token),
        expiresAt: { $gt: new Date() },
    });
};

// Logout: session row hata do => ye token ab kisi bhi browser me kaam nahi karega (copy kiya hua bhi nahi)
export const deleteSession = async (token) => {
    if (typeof token !== 'string' || !token) return;
    await Session.deleteOne({ tokenHash: hashToken(token) });
};
