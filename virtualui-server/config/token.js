import jwt from 'jsonwebtoken';
import { env } from './env.js';

// Token kitne time tak valid rahega (7 din)
const TOKEN_EXPIRY = '7d';

// JWT_SECRET missing ho to config/env.js startup pe hi error de deta hai

// User ke liye signed JWT banata hai. Payload me sirf userId rakha hai (sensitive data kabhi nahi)
// Sync hai: jwt.sign callback ke bina synchronous chalta hai, async/await ki zarurat nahi.
export const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        env.JWT_SECRET,
        {
            expiresIn: TOKEN_EXPIRY,
            // Algorithm explicitly set kiya, taaki verify side pe same pin kar sakein
            algorithm: "HS256"
        }
    );
}

// Token verify karta hai. Invalid ya expired token pe jwt error throw karta hai
export const verifyToken = (token) => {
    // `algorithms` pin karna zaroori hai, warna algorithm-confusion attack ka risk rehta hai
    const data = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] })
    return data;
}
