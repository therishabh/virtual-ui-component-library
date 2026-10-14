import { Schema, model } from 'mongoose';

/**
 * Session = ek refresh token ka DB record. (Ek user ke kai sessions ho sakte hain: phone, laptop, ...)
 *
 * Kyu DB me rakhte hain: JWT khud stateless hai, usse beech me cancel nahi kar sakte. Refresh token ka
 * record DB me rakhne se hum logout pe asli revoke, "logout all devices", aur chori ka detection kar sakte hain.
 *
 * Rotation: har refresh pe purana token revoke hota hai aur naya record banta hai. Ek hi login ke saare
 * records ek `family` share karte hain, taaki reuse pakadne pe poori family revoke ho sake.
 */
const sessionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Refresh JWT ki jti. Lookup isi se hota hai
    jti: {
        type: String,
        required: true,
        unique: true,
    },
    // Ek login se bani poori rotation chain ki id
    family: {
        type: String,
        required: true,
        index: true,
    },
    // Token ka SHA-256 hash. Raw token DB me kabhi nahi (password hash jaisa logic):
    // DB leak ho to bhi attacker ke paas use karne layak token nahi hota.
    tokenHash: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    // null = active. Date = revoke ho chuka (rotate hua, logout hua, ya reuse detect hua)
    revokedAt: {
        type: Date,
        default: null,
    },
    // Rotation me is token ki jagah jo naya token bana uski jti (audit trail ke liye)
    replacedBy: {
        type: String,
        default: null,
    },
    // Metadata: user ko "active devices" dikhane aur suspicious activity pakadne ke kaam aata hai
    userAgent: String,
    ip: String,
}, {
    timestamps: true,
    versionKey: false,
});

// "Logout all" / active sessions list ke liye: user ke saare active sessions fast
sessionSchema.index({ user: 1, revokedAt: 1 });

// TTL index: expiresAt nikalte hi MongoDB record khud delete kar deta hai (collection bada nahi hota).
// expireAfterSeconds: 0 matlab "expiresAt ki exact date pe delete".
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = model('Session', sessionSchema);

export default Session;
