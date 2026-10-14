import jwt from 'jsonwebtoken';

// Token kitne time tak valid rahega (7 din)
const TOKEN_EXPIRY = '7d';

// JWT_SECRET function ke andar read karte hain (module level pe nahi), aur missing ho to turant clear error
const getSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not defined");
    return secret;
}


// User ke liye signed JWT banata hai. Payload me sirf userId rakha hai (sensitive data kabhi nahi)
// Sync hai: jwt.sign callback ke bina synchronous chalta hai, async/await ki zarurat nahi.
export const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        getSecret(),
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
    const data = jwt.verify(token, getSecret(), { algorithms: ["HS256"] })
    return data;
}
