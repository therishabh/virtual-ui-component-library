import { Schema, model } from 'mongoose';

// Roles ek jagah define karo, taaki controllers/middleware me bhi same constant use ho sake
export const ROLES = Object.freeze({
    ADMIN: 'ADMIN',
    USER: 'USER',
});

const userSchema = new Schema({
    name: {
        type: String,
        trim: true,
        required: [true, 'Name is required'],
        maxlength: 100,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true, // sahi spelling lowercase hai, "lowerCase" ko mongoose silently ignore karta hai
        required: [true, 'Email is required'],
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    // Password ka argon2 hash (plain password kabhi store nahi hota). Google-only users ke paas ye nahi hota.
    // select: false => normal queries me ye field aata hi nahi, galti se response/log me leak nahi hoga.
    // Login ke time explicitly mangna padta hai: User.findOne(...).select('+passwordHash')
    passwordHash: {
        type: String,
        select: false,
    },
    // Email ka malik hone ka proof mila hai ya nahi. Google verified email deta hai => true.
    // Password signup me abhi email verify nahi hoti => false (account linking ki security me kaam aata hai).
    emailVerified: {
        type: Boolean,
        default: false,
    },
    // Google ka stable user id (`sub`). Email badal sakta hai, `sub` nahi, isliye account ko ye pehchaan deta hai
    googleId: {
        type: String,
    },
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.USER,
    },
    aiCredits: {
        type: Number,
        default: 150,
        min: [0, 'aiCredits cannot be negative'], // credits minus me na jayein
    },
}, {
    timestamps: true,
    versionKey: false,
});

// email pe unique index (duplicate users rokne ke liye, aur email se lookup fast)
userSchema.index({ email: 1 }, { unique: true });

// googleId unique, par optional: partial index sirf unhi docs ko index karta hai jinme googleId string hai.
// (Normal unique index me googleId missing wale sab docs "null" maane jate aur duplicate error dete.)
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });

const User = model('User', userSchema);

export default User;
