import { Schema, model } from 'mongoose';

/**
 * Email ke through jane wale ek-baar-use tokens: email verification aur password reset.
 * (Dono ka logic same hai: random token email me jata hai, DB me uska hash rehta hai, click pe verify.)
 *
 * Kyu JWT nahi, random token: ye DB me hai, isliye hum use kabhi bhi delete/invalidate kar sakte hain
 * (ek baar use hone pe, ya naya link maangne pe). Random 256-bit token guess nahi hota.
 *
 * Raw token DB me nahi, SHA-256 hash: DB leak ho to bhi koi link use nahi kar sakta
 * (SHA-256 yahan theek hai, argon2 nahi: token already 256 bit random hai, brute-force possible hi nahi).
 */
export const EMAIL_TOKEN_TYPES = Object.freeze({
    VERIFY_EMAIL: 'VERIFY_EMAIL',
    RESET_PASSWORD: 'RESET_PASSWORD',
});

const emailTokenSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: Object.values(EMAIL_TOKEN_TYPES),
        required: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});

// "Is user ke is type ke purane tokens hatao" (naya link maangne pe) fast ho, isliye
emailTokenSchema.index({ user: 1, type: 1 });

// TTL index: expire hote hi MongoDB record khud delete kar deta hai
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailToken = model('EmailToken', emailTokenSchema);

export default EmailToken;
