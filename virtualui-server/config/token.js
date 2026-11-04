import jwt from 'jsonwebtoken';
import { env } from './env.js';

// Access token chhota rakha hai (15 min). Kyu: ye har request ke saath jaata hai, to chori hone ka chance
// sabse zyada isi ka hai. Chhota expiry = chori hua access token jaldi bekaar. Lamba session refresh token se chalta hai.
// Cookie ka maxAge bhi isi se set hota hai, taaki cookie aur JWT ek saath expire hon.
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

// JWT_SECRET missing ho to config/env.js startup pe hi error de deta hai

// Access token banata hai. Payload me userId + sid (session id), sensitive data kabhi nahi.
// sid isliye: logout/revoke hone pe isAuth DB me session dekh sake, token expire hone ka wait na karna pade.
// Sync hai: jwt.sign callback ke bina synchronous chalta hai, async/await ki zarurat nahi.
export const generateAccessToken = (userId, sessionId) => {
    return jwt.sign(
        { userId, sid: sessionId },
        env.JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_TTL_MS / 1000, // seconds
            // Algorithm explicitly set kiya, taaki verify side pe same pin kar sakein
            algorithm: "HS256"
        }
    );
}

// Token verify karta hai. Invalid ya expired token pe jwt error throw karta hai
export const verifyAccessToken = (token, options = {}) => {
    // `algorithms` pin karna zaroori hai, warna algorithm-confusion attack ka risk rehta hai
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], ...options })
}
