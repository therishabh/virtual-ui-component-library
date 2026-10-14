// dotenv yahan bhi import hai, taaki is file ko koi bhi pehle import kare, .env load ho chuka ho.
// (ESM me imports hoist hote hain, isliye order pe depend mat raho.)
import 'dotenv/config';

/**
 * Env variables ek jagah validate + parse hote hain (fail fast).
 *
 * Senior rule: process.env ko poore code me jagah-jagah mat padho. Startup pe ek baar validate karo,
 * aur baaki code `env` object use kare. Galat/missing config pe server start hote hi band ho jaye,
 * runtime pe random jagah crash na ho (jaise pehli login request pe "secret undefined").
 */
const errors = [];

const required = (key) => {
    const value = process.env[key]?.trim();
    if (!value) errors.push(`${key} is required`);
    return value;
};

const optionalInt = (key, fallback) => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        errors.push(`${key} must be a positive integer`);
        return fallback;
    }
    return parsed;
};

// .env me multi-line PEM keys "\n" escaped hoti hain, unhe asli newline me badlo
const pem = (value) => value?.replace(/\\n/g, '\n');

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

if (!['HS256', 'RS256'].includes(JWT_ALGORITHM)) {
    errors.push('JWT_ALGORITHM must be HS256 or RS256');
}

const jwt = { algorithm: JWT_ALGORITHM };

if (JWT_ALGORITHM === 'HS256') {
    // HS256: ek shared secret sign aur verify dono karta hai
    jwt.accessSecret = required('JWT_SECRET');
    jwt.refreshSecret = required('JWT_REFRESH_SECRET');

    // Weak ya same secret = risk. Access aur refresh ke secret alag hone chahiye, taaki ek leak ho to doosra safe rahe.
    if (jwt.accessSecret && jwt.accessSecret.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
    if (jwt.refreshSecret && jwt.refreshSecret.length < 32) errors.push('JWT_REFRESH_SECRET must be at least 32 characters');
    if (jwt.accessSecret && jwt.accessSecret === jwt.refreshSecret) errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
} else {
    // RS256: private key se sign, public key se verify. kid (key id) rotation ke liye zaroori hai.
    jwt.privateKey = pem(required('JWT_PRIVATE_KEY'));
    jwt.publicKey = pem(required('JWT_PUBLIC_KEY'));
    jwt.keyId = required('JWT_KEY_ID');

    // Rotation window: purani public keys {kid: key}. Jab tak purane tokens expire na ho jayein, ye rakho.
    jwt.previousPublicKeys = {};
    if (process.env.JWT_PREVIOUS_PUBLIC_KEYS) {
        try {
            const parsed = JSON.parse(process.env.JWT_PREVIOUS_PUBLIC_KEYS);
            for (const [kid, key] of Object.entries(parsed)) jwt.previousPublicKeys[kid] = pem(key);
        } catch {
            errors.push('JWT_PREVIOUS_PUBLIC_KEYS must be valid JSON ({"kid":"PEM"})');
        }
    }
}

const env = {
    NODE_ENV,
    isProduction: NODE_ENV === 'production',
    PORT: optionalInt('PORT', 8000),
    MONGO_URI: required('MONGO_URI'),
    GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
    // Access token chhota (15 min): chori ho to damage limited. Refresh lamba (7 din): user baar-baar login na kare.
    ACCESS_TTL_SECONDS: optionalInt('JWT_ACCESS_TTL_SECONDS', 15 * 60),
    REFRESH_TTL_SECONDS: optionalInt('JWT_REFRESH_TTL_SECONDS', 7 * 24 * 60 * 60),
    // Reverse proxy ke peeche ho to req.ip (rate limit) sahi IP se ho, uske liye
    TRUST_PROXY: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : undefined,
    jwt,
};

if (errors.length > 0) {
    // Saari galtiyan ek saath dikhao, ek-ek karke fix na karni pade
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
}

export default Object.freeze(env);
