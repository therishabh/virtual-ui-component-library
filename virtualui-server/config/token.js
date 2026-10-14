import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import env from './env.js';

/**
 * JWT primitives: sirf token banana aur verify karna. DB ya HTTP ka kuch yahan nahi.
 * (Session/refresh ka DB logic services/session.service.js me hai.)
 *
 * Standard claims (RFC 7519) use kiye hain:
 *  - sub (subject)  : token kis user ka hai (pehle custom `userId` tha, standard `sub` hai)
 *  - iss (issuer)   : token kisne banaya. Verify pe check hota hai
 *  - aud (audience) : token kis kaam ke liye hai. "access" aur "refresh" alag, taaki refresh token
 *                     ko access token bana ke use na kiya ja sake (token confusion attack)
 *  - jti (JWT id)   : har token ki unique id. Refresh token ko DB me track/revoke karne me kaam aati hai
 *  - exp / iat      : jwt library khud lagati hai
 */
export const ISSUER = 'virtualui-server';
export const AUDIENCE = Object.freeze({
    ACCESS: 'virtualui:access',
    REFRESH: 'virtualui:refresh',
});

const { jwt: jwtConfig } = env;

// --- Key selection --------------------------------------------------------------------------------
// HS256: access aur refresh ke alag secrets. RS256: ek keypair, `kid` header ke saath (key rotation).

const getSigningMaterial = (type) => {
    if (jwtConfig.algorithm === 'RS256') {
        return { key: jwtConfig.privateKey, header: { kid: jwtConfig.keyId } };
    }
    return { key: type === 'access' ? jwtConfig.accessSecret : jwtConfig.refreshSecret, header: {} };
};

const getVerificationKey = (type, token) => {
    if (jwtConfig.algorithm === 'HS256') {
        return type === 'access' ? jwtConfig.accessSecret : jwtConfig.refreshSecret;
    }

    // RS256: token ke header se `kid` padho (abhi verify nahi hua, sirf key chunne ke liye) aur
    // usi kid ki public key se verify karo. Isse rotation ke dauran purane tokens bhi chalte rahte hain.
    const kid = jwt.decode(token, { complete: true })?.header?.kid;
    if (kid === jwtConfig.keyId) return jwtConfig.publicKey;
    if (kid && jwtConfig.previousPublicKeys[kid]) return jwtConfig.previousPublicKeys[kid];
    throw new jwt.JsonWebTokenError('unknown key id');
};

// --- Sign -----------------------------------------------------------------------------------------

/**
 * Access token: chhota (15 min), stateless (verify ke liye DB nahi chahiye).
 * Payload me role bhi hai taaki requireRole bina DB hit ke check kar sake.
 * Trade-off: role badalne pe naya role max 15 min baad lagega (access token expire hone pe).
 */
export const signAccessToken = ({ userId, role }) => {
    const { key, header } = getSigningMaterial('access');
    return jwt.sign({ role }, key, {
        algorithm: jwtConfig.algorithm,
        expiresIn: env.ACCESS_TTL_SECONDS,
        issuer: ISSUER,
        audience: AUDIENCE.ACCESS,
        subject: String(userId),
        jwtid: randomUUID(),
        header,
    });
};

/**
 * Refresh token: lamba (7 din), sirf naya access token lene ke liye. Isme role/data nahi, sirf sub + jti.
 * jti ko caller DB me save karta hai (rotation + reuse detection ke liye), isliye jti aur expiry return karte hain.
 */
export const signRefreshToken = ({ userId }) => {
    const { key, header } = getSigningMaterial('refresh');
    const jti = randomUUID();
    const token = jwt.sign({}, key, {
        algorithm: jwtConfig.algorithm,
        expiresIn: env.REFRESH_TTL_SECONDS,
        issuer: ISSUER,
        audience: AUDIENCE.REFRESH,
        subject: String(userId),
        jwtid: jti,
        header,
    });
    return { token, jti, expiresAt: new Date(Date.now() + env.REFRESH_TTL_SECONDS * 1000) };
};

// --- Verify ---------------------------------------------------------------------------------------
// Teeno cheezein pin karte hain: algorithms (algorithm-confusion attack se bachav), issuer, audience.
// Invalid/expired token pe jsonwebtoken error throw karta hai (JsonWebTokenError / TokenExpiredError).

export const verifyAccessToken = (token) =>
    jwt.verify(token, getVerificationKey('access', token), {
        algorithms: [jwtConfig.algorithm],
        issuer: ISSUER,
        audience: AUDIENCE.ACCESS,
    });

export const verifyRefreshToken = (token) =>
    jwt.verify(token, getVerificationKey('refresh', token), {
        algorithms: [jwtConfig.algorithm],
        issuer: ISSUER,
        audience: AUDIENCE.REFRESH,
    });
