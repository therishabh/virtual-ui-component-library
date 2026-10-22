// dotenv yahin import hota hai, taaki jo bhi module `env` import kare, .env uske pehle load ho chuka ho.
// (ESM me imports hoist hote hain, isliye alag se server.js ke top pe dotenv ka order sambhalna fragile tha.)
import 'dotenv/config';

// Ye env vars na ho to server start hi nahi hona chahiye
const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

// Fail fast: ek hi baar me saare missing vars batao, runtime pe (request ke beech) undefined se crash hone ki jagah
const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
    throw new Error(`Missing required env variables: ${missing.join(', ')}`);
}

// Poore server me process.env ki jagah sirf yahi `env` use karo.
// Fayda: ek jagah pe saare vars + defaults + type conversion (PORT number), typo pe undefined ka risk kam.
// freeze: runtime me koi galti se value badal na sake.
export const env = Object.freeze({
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
    PORT: Number(process.env.PORT) || 8000,
    CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173', // Vite ka fixed port (strictPort: true)
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
});
