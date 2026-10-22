import { generateToken } from "../config/token.js";
import { env } from "../config/env.js";
import User from "../models/user.model.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

    // 4) Token generate karo (sync function hai, await nahi chahiye). Payload me sirf id.
    const token = generateToken(user._id);
    res.cookie("token", token, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });

    // 5) Naya user = 201 Created, existing = 200 OK. Message bhi usi hisab se.
    return res.status(isNewUser ? 201 : 200).json({
        status: true,
        message: isNewUser ? "User created successfully" : "Login successful",
        data: user,
    });
};

/**
 * POST /auth/logout
 *
 * JWT stateless hai, server pe session nahi hota, isliye logout = cookie clear karna.
 * (Token ko turant invalidate karna ho to blacklist ya short-lived token + refresh token chahiye.)
 */
export const logout = (_req, res) => {
    // clearCookie sync hai, await/try-catch ki zarurat nahi
    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
        status: true,
        message: "Logout successful",
    });
};
