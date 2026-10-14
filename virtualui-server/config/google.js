import { OAuth2Client } from 'google-auth-library';
import env from './env.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Google ka ID token server pe verify karta hai aur trusted profile return karta hai.
 *
 * SECURITY RULE: client (browser) ke bheje email/name pe kabhi trust mat karo, wo koi bhi bhej sakta hai.
 * Client sirf Google ka signed `idToken` bhejta hai. Hum Google ki public keys se uski signature, expiry,
 * issuer aur `audience` (hamara GOOGLE_CLIENT_ID) verify karte hain, aur email/name token ke payload se lete hain.
 *
 * `audience` check bahut zaroori hai: iske bina kisi doosri app ke liye bana Google token bhi accept ho jata.
 */
export const verifyGoogleIdToken = async (idToken) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    return {
        googleId: payload.sub,               // Google ka stable user id (email badal sakta hai, sub nahi)
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name ?? payload.email, // name optional hota hai
    };
};
