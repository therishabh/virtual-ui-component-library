// ESM me extension (.js) zaroori hai, warna ERR_MODULE_NOT_FOUND aata hai
import { verifyAccessToken } from "../config/token.js";
import { isSessionActive } from "../services/session.service.js";

// Protected routes ke aage lagao: access token (cookie) verify karke req.userId set karta hai.
//
// 2 checks kyu:
//  1) JWT signature + expiry (15 min): chori hua token jaldi expire ho jata hai
//  2) DB me session abhi bhi hai: logout ke baad bache 15 min me bhi token kaam na kare
// Scale badhne pe (2) hata ke sirf JWT pe chal sakte hain, tab logout 15 min tak delay se effect karega (trade-off).
//
// 401 pe client ka axios interceptor /api/auth/refresh try karta hai, isliye expired token ka 401 normal hai.
const isAuth = async (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (!token) {
            // return zaroori hai, warna neeche ka code bhi chalega (double response / throw)
            return res.status(401).json({ status: false, message: "User should be logged in" });
        }

        // Invalid / tampered / expired token pe verifyAccessToken throw karta hai, catch me 401
        const { userId, sid } = verifyAccessToken(token);

        if (!(await isSessionActive(sid))) {
            return res.status(401).json({ status: false, message: "Session ended" });
        }

        // userId aage controllers me kaam aayega, sid logout me
        req.userId = userId;
        req.sessionId = sid;
        next();
    } catch {
        return res.status(401).json({ status: false, message: "Invalid or expired token" });
    }
};

export default isAuth;
