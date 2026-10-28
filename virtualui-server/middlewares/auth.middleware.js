import { findValidSession } from "../services/session.service.js";

// Protected routes ke aage lagao: cookie ke token se DB me session dhundta hai aur req.userId set karta hai.
//
// Pehle yahan JWT verify hota tha (sirf signature + expiry). Ab session DB me bhi hona chahiye,
// isliye logout ke baad ya session revoke hone pe purana/copy kiya hua token turant 401 dega.
const isAuth = async (req, res, next) => {
    // Express 5 me async middleware ka error khud error handler tak jata hai, try/catch ki zarurat nahi.
    const { token } = req.cookies;

    // Token nahi hai, ya DB me session nahi mili / expire ho gayi / logout ho chuka hai: sab 401
    // (Alag messages nahi diye, taaki attacker ko ye na pata chale ki token kyu fail hua)
    const session = await findValidSession(token);
    if (!session) {
        // return zaroori hai, warna neeche ka code bhi chalega (double response)
        return res.status(401).json({
            status: false,
            message: "User should be logged in"
        });
    }

    // userId aage controllers me kaam aayega
    req.userId = session.userId;
    next();
};

export default isAuth;
