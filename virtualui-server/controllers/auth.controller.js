import { env } from "../config/env.js";
import User from "../models/user.model.js";
import { createSession, deleteSession, SESSION_TTL_MS } from "../services/session.service.js";

// Cookie options ek jagah define karo. clearCookie ko set karte time ke same options chahiye
// (maxAge ko chhodke), warna browser cookie delete nahi karta.
const cookieOptions = {
    httpOnly: true,                                   // JS se cookie padhi nahi ja sakti (XSS se token chori hone ka risk kam)
    secure: env.isProduction,    // production me sirf HTTPS pe bheji jaye. Hardcode false mat rakho
    sameSite: "lax",                                  // CSRF se bachav. Frontend alag domain pe ho to "none" + secure chahiye
};

/**
 * POST /auth/google
 *
 * Flow: input validate -> user find/create -> JWT cookie set -> response.
 *
 * TODO (SECURITY): abhi email/name seedha req.body se aa rahe hain, matlab koi bhi
 * kisi ka bhi email bhej ke uska account use kar sakta hai. Production se pehle client se
 * Google ka ID token lo aur server pe verify karo (google-auth-library ka verifyIdToken),
 * phir email/name token ke payload se lo, body se nahi. Client ke bheje data pe kabhi trust mat karo.
 */
export const googleAuth = async (req, res) => {
    // Express 5 me async handler ka error automatically error middleware tak jata hai,
    // isliye har controller me try/catch likhne ki zarurat nahi.
    const { email, name } = req.body ?? {};

    // 1) Validation: type check zaroori hai. Agar email object ho (jaise {"$ne": null})
    // to findOne({email}) NoSQL injection ban jata hai aur koi bhi user mil jata hai.
    if (typeof email !== "string" || typeof name !== "string" || !email.trim() || !name.trim()) {
        return res.status(400).json({
            status: false,
            message: "Valid name and email are required",
        });
    }

    // 2) Normalize: lookup se pehle email ko lowercase/trim karo, taaki duplicate users na bane
    const normalizedEmail = email.trim().toLowerCase();

    // 3) Find-or-create: pehle user dhundo, nahi mila to create karo
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;

    if (!user) {
        try {
            user = await User.create({ name: name.trim(), email: normalizedEmail });
            isNewUser = true;
        } catch (error) {
            // Race condition: do requests ek saath aayein to dono findOne me "nahi mila" dekhte hain,
            // phir ek create hota hai aur doosra unique index pe E11000 (duplicate key) se fail hota hai.
            // Us case me error mat do, jo user ab ban chuka hai usse wapas fetch kar lo.
            if (error.code !== 11000) throw error;
            user = await User.findOne({ email: normalizedEmail });
        }
    }

    // 4) Pehle purana session (agar cookie me hai) hata do, phir naya banao.
    // Kyu: har login pe fresh token milta hai (session fixation se bachav) aur purani rows DB me jama nahi hoti.
    await deleteSession(req.cookies.token);
    const token = await createSession(user._id, req);
    // maxAge session ki expiry ke barabar, taaki cookie aur DB row ek saath expire hon
    res.cookie("token", token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

    // 5) Naya user = 201 Created, existing = 200 OK. Message bhi usi hisab se.
    return res.status(isNewUser ? 201 : 200).json({
        status: true,
        message: isNewUser ? "User created successfully" : "Login successful",
        data: user,
    });
};

export const meAuthController = async(req, res) => {
    const {userId} = req
    const userInfo = await User.findById(userId);

    // Session valid hai par user DB se delete ho chuka ho to null aayega; bina check ke niche crash hota.
    // (userInfo ko console.log nahi karte: har request pe user ka data logs me leak hota tha)
    if (!userInfo) {
        return res.status(401).json({ status: false, message: "User should be logged in" });
    }

    return res.status(200).json({
        name : userInfo.name,
        email : userInfo.email,
        aiCredits: userInfo.aiCredits,
        status : true, 
        message : "success"
    })
}

/**
 * POST /auth/logout
 *
 * Pehle: JWT stateless tha, to logout = sirf cookie clear, token 7 din tak valid rehta tha.
 * Ab: DB se session delete karte hain, isliye cookie kisi ne copy kar rakhi ho tab bhi wo token dead ho jata hai.
 *
 * isAuth is route pe nahi lagaya: session expire ho chuki ho tab bhi logout 200 de aur cookie clear kare (idempotent).
 */
export const logout = async (req, res) => {
    await deleteSession(req.cookies.token);

    // clearCookie sync hai; options same chahiye (upar cookieOptions ka comment dekho)
    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
        status: true,
        message: "Logout successful",
    });
};
