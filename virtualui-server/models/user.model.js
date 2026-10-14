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

const User = model('User', userSchema);

export default User;
