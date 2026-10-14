import env from '../config/env.js';

/**
 * Mail bhejne ki service. Abhi sirf CONSOLE transport hai: email bhejne ki jagah link terminal me print hota hai.
 *
 * Design: baaki app sirf sendVerificationEmail / sendPasswordResetEmail bulata hai. Asli provider
 * (Resend, SendGrid, SES, SMTP) lagana ho to sirf `transport` function badalna hai, controllers/flows ko kuch nahi.
 *
 * SECURITY: console transport sirf development ke liye hai. Verify/reset links logs me print hona
 * production me khatarnak hai (logs padhne wala koi bhi account hijack kar sakta hai), isliye production me
 * ye transport error throw karta hai aur link print nahi karta.
 */

const consoleTransport = async ({ to, subject, text }) => {
    if (env.isProduction) {
        throw new Error('No mail transport configured (console transport is disabled in production)');
    }
    console.log(
        [
            '',
            '================= [DEV MAIL] =================',
            `To:      ${to}`,
            `Subject: ${subject}`,
            '----------------------------------------------',
            text,
            '==============================================',
            '',
        ].join('\n'),
    );
};

let transport = consoleTransport;

/** Transport badalne ke liye (asli provider lagane ke liye, ya tests me mail capture karne ke liye). */
export const setMailTransport = (fn) => {
    transport = fn ?? consoleTransport;
};

export const sendVerificationEmail = ({ to, name, token }) => {
    const link = `${env.CLIENT_URL}/verify-email?token=${token}`;
    return transport({
        to,
        subject: 'Verify your email',
        text: `Hi ${name},\n\nEmail verify karne ke liye ye link kholo (24 ghante tak valid):\n${link}\n\nAgar aapne account nahi banaya, to is email ko ignore karo.`,
        link,
        token,
        type: 'VERIFY_EMAIL',
    });
};

export const sendPasswordResetEmail = ({ to, name, token }) => {
    const link = `${env.CLIENT_URL}/reset-password?token=${token}`;
    return transport({
        to,
        subject: 'Reset your password',
        text: `Hi ${name},\n\nPassword reset karne ke liye ye link kholo (1 ghante tak valid):\n${link}\n\nAgar aapne ye request nahi ki, to is email ko ignore karo, aapka password nahi badla hai.`,
        link,
        token,
        type: 'RESET_PASSWORD',
    });
};
