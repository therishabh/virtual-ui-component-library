import { ApiError } from '../utils/ApiError.js';

/**
 * Central error handler: app ke saare errors yahin aate hain, response ka format ek jaisa rehta hai.
 * Express 5 me async handler ka throw/reject automatically yahan pahunchta hai (try/catch nahi chahiye).
 *
 * Rules:
 *  - Expected errors (ApiError): jo message diya wahi client ko jata hai.
 *  - Unexpected errors: poora error sirf server log me. Client ko generic 500 (stack/internals kabhi leak mat karo).
 *
 * 4 arguments (err, req, res, next) hona zaroori hai, tabhi Express ise error handler maanta hai.
 */
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof ApiError) {
        return res.status(err.status).json({ status: false, message: err.message, code: err.code });
    }

    // express.json() ko kharab JSON mila, ya body limit se badi hai: ye client ki galti hai (400 / 413)
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ status: false, message: 'Invalid JSON body', code: 'BAD_JSON' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ status: false, message: 'Request body too large', code: 'BODY_TOO_LARGE' });
    }

    // Mongoose schema validation fail: client ka data galat hai
    if (err.name === 'ValidationError') {
        return res.status(400).json({ status: false, message: err.message, code: 'VALIDATION_ERROR' });
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({ status: false, message: 'Internal server error', code: 'INTERNAL_ERROR' });
};

// Koi route match nahi hua to 404 (JSON me, Express ka default HTML nahi)
export const notFoundHandler = (req, res) => {
    res.status(404).json({ status: false, message: 'Route not found', code: 'NOT_FOUND' });
};
