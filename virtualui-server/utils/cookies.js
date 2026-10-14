import env from '../config/env.js';

/**
 * Auth cookies ek jagah. Dono tokens httpOnly cookies me jate hain (JS se padhe nahi ja sakte, XSS se
 * chori ka risk kam). localStorage me token rakhna XSS me seedha chori ho jata hai.
 *
 * Do cookies kyu aur path alag kyu:
 *  - accessToken  : path "/"           -> har API request ke saath jata hai
 *  - refreshToken : path "/api/auth"   -> sirf auth endpoints (/refresh, /logout) pe jata hai, baaki
 *                                         requests ke saath nahi. Exposure kam = chori ka chance kam.
 *
 * clearCookie ko set ke same options (path, sameSite, secure, httpOnly) chahiye, nahi to browser cookie delete nahi karta.
 */
const baseOptions = {
    httpOnly: true,
    secure: env.isProduction,   // production me sirf HTTPS pe. Frontend alag domain pe ho to sameSite "none" + secure chahiye
    sameSite: 'lax',            // CSRF se bachav
};

const accessOptions = { ...baseOptions, path: '/' };
const refreshOptions = { ...baseOptions, path: '/api/auth' };

export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
    // maxAge milliseconds me hota hai, cookie ki life token ki life ke barabar rakhi hai
    res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: env.ACCESS_TTL_SECONDS * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshOptions, maxAge: env.REFRESH_TTL_SECONDS * 1000 });
};

export const clearAuthCookies = (res) => {
    res.clearCookie(ACCESS_COOKIE, accessOptions);
    res.clearCookie(REFRESH_COOKIE, refreshOptions);
};
