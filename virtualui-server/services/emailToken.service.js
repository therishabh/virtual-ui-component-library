import { createHash, randomBytes } from 'node:crypto';
import EmailToken, { EMAIL_TOKEN_TYPES } from '../models/emailToken.model.js';

/**
 * Email tokens ka lifecycle: create -> (email me bhejo) -> consume (ek baar).
 */

// Har type ki life alag: verification link ko din bhar chalne do, par reset link jaldi mare (zyada sensitive)
const TTL_MS = {
    [EMAIL_TOKEN_TYPES.VERIFY_EMAIL]: 24 * 60 * 60 * 1000, // 24 ghante
    [EMAIL_TOKEN_TYPES.RESET_PASSWORD]: 60 * 60 * 1000,    // 1 ghanta
};

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Naya token banao aur RAW token return karo (isse email me bhejna hai, DB me sirf hash gaya).
 * Us user ke us type ke purane tokens delete: "resend" karne pe sirf sabse naya link chalta hai.
 */
export const createEmailToken = async (userId, type) => {
    await EmailToken.deleteMany({ user: userId, type });

    const token = randomBytes(32).toString('base64url'); // 256-bit random, URL-safe
    await EmailToken.create({
        user: userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TTL_MS[type]),
    });
    return token;
};

/**
 * Token ko ek baar use karo (consume). Valid ho to user id return, warna null.
 *
 * "Ek baar" ka matlab: pehle record dhundo, phir deleteOne. deletedCount === 1 check atomic claim hai:
 * do requests ek saath same token bhejein to sirf ek ka delete hoga, doosri ko null milega.
 * Invalid / expired / dobara use, sab ke liye null (caller ko wajah nahi batate).
 */
export const consumeEmailToken = async (token, type) => {
    if (typeof token !== 'string' || !token) return null;

    const record = await EmailToken.findOne({
        tokenHash: hashToken(token),
        type,
        expiresAt: { $gt: new Date() },
    });
    if (!record) return null;

    const { deletedCount } = await EmailToken.deleteOne({ _id: record._id });
    return deletedCount === 1 ? record.user : null;
};

/** User ke saare email tokens hatao (password reset ke baad, ya Google link ke baad purane links bekaar karne ke liye). */
export const deleteUserEmailTokens = (userId) => EmailToken.deleteMany({ user: userId });
