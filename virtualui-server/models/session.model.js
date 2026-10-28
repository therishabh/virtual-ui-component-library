import { Schema, model } from 'mongoose';

// Server-side session: "ye token abhi bhi valid hai ya nahi" ka faisla ab DB se hota hai.
//
// Problem jo ye solve karta hai: pehle JWT stateless tha, to logout pe sirf cookie clear hoti thi
// aur token 7 din tak valid rehta tha. Koi cookie copy kar le (DevTools, malware, shared PC) to
// logout ke baad bhi login reh sakta tha. Ab session row delete = token turant dead.
const sessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true, // "is user ke saare sessions" (logout all devices) fast nikalne ke liye
    },
    // Cookie wala raw token DB me kabhi store nahi karte, sirf uska SHA-256 hash.
    // Kyu: DB leak ho jaye to bhi attacker ke paas live sessions nahi aayenge (password hash jaisi soch)
    tokenHash: {
        type: String,
        required: true,
        unique: true, // lookup isi se hota hai, isliye unique index (fast + duplicate nahi)
    },
    // Neeche ke 2 fields sirf info ke liye hain (future me "active devices" list dikhane ke kaam aayenge).
    // Inpe auth decision mat lo: IP/user-agent badalte rehte hain (mobile data, WiFi), false logout hoga.
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
    expiresAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});

// TTL index: expiresAt nikal jane pe MongoDB expired sessions khud delete kar deta hai (cleanup job nahi likhni).
// Note: Mongo ka TTL monitor ~60 sec me ek baar chalta hai, isliye service me expiry hum khud bhi check karte hain.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = model('Session', sessionSchema);

export default Session;
