// ESM me extension (.js) zaroori hai, warna ERR_MODULE_NOT_FOUND aata hai
import { verifyToken } from "../config/token.js";

// Protected routes ke aage lagao: cookie se JWT verify karke req.userId set karta hai
const isAuth = (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (!token) {
            // return zaroori hai, warna neeche ka code bhi chalega (double response / throw)
            // Login nahi hai to 401 (400 bad request hota hai, auth fail nahi)
            return res.status(401).json({
                status: false,
                message: "User should be logged in"
            });
        }

        // userId aage controllers me kaam aayega
        req.userId = verifyToken(token).userId;
        next();
    } catch {
        // Invalid / tampered / expired token: verifyToken throw karta hai.
        // Catch khaali hota to request hang ho jati, isliye 401 bhejna zaroori hai
        return res.status(401).json({
            status: false,
            message: "Invalid or expired token"
        });
    }
};

export default isAuth;
