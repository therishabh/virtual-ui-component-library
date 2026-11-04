import { Schema, model } from 'mongoose';

// Server-side session (hybrid design: short access JWT + long refresh token).
//
// Problem jo ye solve karta hai: pehle JWT stateless tha, to logout pe sirf cookie clear hoti thi
// aur token 7 din tak valid rehta tha. Koi cookie copy kar le (DevTools, malware, shared PC) to
// logout ke baad bhi login reh sakta tha. Ab session row delete = refresh token aur access token dono dead.
const sessionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true, // "is user ke saare sessions" (logout all devices) fast nikalne ke liye
    },
    // Refresh token ka SHA-256 hash (raw token DB me kabhi nahi).
    // Kyu: DB leak ho jaye to bhi attacker ke paas live refresh tokens nahi aayenge (password hash jaisi soch)
    refreshHash: {
        type: String,
        required: true,
        unique: true, // lookup isi se hota hai, isliye unique index (fast + duplicate nahi)
    },
    // Rotation ke baad ka PURANA refresh hash + kab rotate hua.
    // Kyu: purana token dobara aaye to 2 hi wajah ho sakti hain:
    //   (a) 2 requests ek saath aayi (race) => rotatedAt ke grace window ke andar hai, benign
    //   (b) kisi ne chori/purana token replay kiya => grace ke baad hai, poora session kill (reuse detection)
    prevRefreshHash: { type: String, index: true },
    rotatedAt: { type: Date },
    // Neeche ke 2 fields sirf info ke liye hain (future me "active devices" list dikhane ke kaam aayenge).
    // Inpe auth decision mat lo: IP/user-agent badalte rehte hain (mobile data, WiFi), false logout hoga.
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
    // ABSOLUTE expiry: session banne ke 30 din baad, rotate hone pe bhi extend nahi hoti.
    // Kyu: warna sliding session kabhi expire nahi hoti, chori hua refresh token hamesha ke liye chalta rehta.
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
