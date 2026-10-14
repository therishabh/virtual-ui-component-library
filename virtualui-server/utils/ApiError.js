/**
 * Expected (operational) errors ke liye custom error: jisme HTTP status code saath chalta hai.
 *
 * Pattern: business logic / middleware me `throw new ApiError(401, "...")` karo, aur
 * central error middleware (middlewares/error.middleware.js) usse sahi response bana dega.
 * Isse har controller me res.status(...).json(...) ka repeat nahi hota.
 *
 * `code` optional machine-readable string hai (jaise "TOKEN_EXPIRED"), taaki frontend message ke text
 * pe depend na kare. Example: TOKEN_EXPIRED pe frontend chupchap /refresh call karke request retry kare.
 */
export class ApiError extends Error {
    constructor(status, message, code) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}
