import pino from 'pino';
import { env } from './env.js';

// Poore server me console.log ki jagah sirf yahi `logger` use karo.
// Kyu pino: structured JSON logs (searchable/parseable), levels, redaction, aur bahut fast (console se halka).
// Error log karte waqt `logger.error({ err }, 'msg')` likho (pehle object, phir message), tab stack trace bhi serialize hota hai.
export const logger = pino({
    // Is level se neeche ke logs ignore hote hain (debug < info < warn < error < fatal). env.js me default set hai.
    level: env.LOG_LEVEL,

    // Sensitive cheezein log me kabhi na jayein. Kyu: pino-http default me poore request headers log karta hai,
    // aur cookies me access/refresh token hote hain, wo logs me leak ho jate.
    redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
    },

    // Dev me readable colored output, prod me raw JSON (log aggregator ke liye).
    // pino-pretty devDependency hai, isliye prod me install nahi hota. Isi wajah se isse sirf non-production me load karte hain,
    // warna prod me "unable to determine transport target" error se server start hi nahi hoga.
    transport: env.isProduction
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});
