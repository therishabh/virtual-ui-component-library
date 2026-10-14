import argon2 from 'argon2';

/**
 * Password hashing ek jagah. Controller kabhi seedha argon2 nahi bulata.
 *
 * Argon2id kyu: OWASP ka first-choice password hashing algorithm. Ye jaan-boojh ke SLOW aur
 * memory-hungry hai, taaki DB leak hone par bhi attacker har password guess karne me bahut time/hardware lagaye.
 * (SHA-256 / MD5 password ke liye galat hain: wo fast hain, attacker billion guesses/sec kar leta hai.)
 *
 * argon2 library defaults (argon2id, 64 MiB memory, 3 passes) OWASP ke recommended range me hain.
 * Salt library khud random banati hai aur hash string me hi store karti hai, alag se salt field nahi chahiye.
 */

// Password ki length limits. Min 8 (NIST guideline). Max 128 zaroori hai: bahut lamba password bhejke
// koi hashing me CPU/memory kha sakta hai (DoS). Composition rules (1 capital, 1 symbol) nahi lagaye:
// NIST bhi unhe discourage karta hai, length zyada kaam ki hai.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const hashPassword = (plainPassword) => argon2.hash(plainPassword);

/** Hash bigda hua ho to verify throw karta hai, usse false maano (login fail), crash nahi. */
export const verifyPassword = async (hash, plainPassword) => {
    try {
        return await argon2.verify(hash, plainPassword);
    } catch {
        return false;
    }
};

/**
 * Agar future me hum argon2 ke parameters (memory/time cost) badhayein, to purane hashes "outdated" ho jate hain.
 * Login pe (jab plain password humare paas hota hai) ye check karke hash ko naye params se dobara bana dete hain.
 */
export const needsRehash = (hash) => argon2.needsRehash(hash);

/**
 * Timing attack se bachne ke liye. Login me agar email DB me nahi hai to hum verify skip karke turant
 * "invalid" bhej dein, to response jaldi aata hai aur attacker time naap ke pata laga leta hai ki
 * kaunsa email registered hai (user enumeration). Isliye email na mile tab bhi ek dummy hash pe
 * verify chalate hain, taaki dono cases me lagbhag same time lage.
 * Lazy hai: pehli baar zarurat pe banta hai (server start slow nahi hota).
 */
let dummyHashPromise;
export const verifyAgainstDummy = async (plainPassword) => {
    dummyHashPromise ??= argon2.hash('dummy-password-for-timing-equalization');
    await verifyPassword(await dummyHashPromise, plainPassword);
};
