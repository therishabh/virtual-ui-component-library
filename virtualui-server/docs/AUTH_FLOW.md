# Auth System: Poora Flow

Google + Email/Password login, Email verification, Password reset/change, Access + Refresh tokens.

Ye document `virtualui-server` ke auth system ko **shuru se end tak** samjhata hai. Isse padhne ke baad kisi bhi file ko khol ke samajh aa jana chahiye ki wo kyu hai aur baaki files se kaise judi hai.

> **Padhne ka order:** 1 (big picture) -> 2 (files) -> 5 se 10 (flows) -> baaki jab zarurat ho.
> **Is doc ko update rakhna:** auth se jude kisi bhi change (route, token, cookie, env, model, flow) ke saath ye file bhi update karo.

---

## Table of contents

1. [Big picture](#1-big-picture)
2. [Files ka map](#2-files-ka-map)
3. [Startup flow](#3-startup-flow)
4. [Ek request ka safar (middleware order)](#4-ek-request-ka-safar)
5. [Andar aane ke flows](#5-andar-aane-ke-flows)
   - [5.1 Google login](#51-google-login)
   - [5.2 Email signup](#52-email-signup)
   - [5.3 Email verification (verify + resend)](#53-email-verification)
   - [5.4 Email login](#54-email-login)
   - [5.5 Google + password ek hi account (linking) aur pre-hijacking](#55-account-linking-aur-pre-hijacking)
6. [Protected request (access token)](#6-protected-request)
7. [Token expire hua: refresh (rotation)](#7-refresh-rotation)
8. [Chori ka detection (reuse detection)](#8-reuse-detection)
9. [Logout aur Logout-all](#9-logout)
10. [Password management (forgot / reset / change)](#10-password-management)
11. [Email tokens aur Mail service](#11-email-tokens-aur-mail-service)
12. [Tokens ke andar kya hai (JWT)](#12-tokens-ke-andar-kya-hai)
13. [Cookies](#13-cookies)
14. [Database models](#14-database-models)
15. [Error handling aur status codes](#15-error-handling-aur-status-codes)
16. [Security decisions](#16-security-decisions)
17. [Config / env variables](#17-config--env-variables)
18. [Naya route kaise add karein](#18-naya-route-kaise-add-karein)
19. [Frontend ko kya karna hai](#19-frontend-contract)
20. [Real-life scenarios](#20-scenarios)
21. [Known limitations aur aage ke kaam](#21-known-limitations)
22. [Quick reference: kaun sa function kahan](#22-quick-reference)

---

## 1. Big picture

**Problem:** User ko ek baar login karna hai, uske baad har request pe server ko pata hona chahiye "ye kaun hai". Login **do tareeko se** ho sakta hai: **Google** se, ya **email + password** se. Email wale user ko pehle **email verify** karni padti hai. Dono tareeko ke baad aage ka system **bilkul same** hai (wahi access + refresh tokens).

### Saare endpoints (`/api/auth/...`)

| Method | Route | Auth | Kaam | Section |
|---|---|---|---|---|
| POST | `/google` | public | Google ID token se login/signup | 5.1 |
| POST | `/signup` | public | Email + password se account (login nahi hota, verify email jati hai) | 5.2 |
| POST | `/verify-email` | public | Email link ka token verify karo | 5.3 |
| POST | `/resend-verification` | public | Verification link dobara bhejo | 5.3 |
| POST | `/login` | public | Email + password login (sirf verified) | 5.4 |
| POST | `/refresh` | refresh cookie | Naya access + refresh token (rotation) | 7 |
| POST | `/logout` | public | Is device ka session revoke | 9 |
| POST | `/logout-all` | `requireAuth` | Saare devices se logout | 9 |
| POST | `/forgot-password` | public | Reset link email karo | 10 |
| POST | `/reset-password` | public (token) | Link ke token se naya password | 10 |
| POST | `/change-password` | `requireAuth` | Logged-in user password badle | 10 |
| GET | `/me` | `requireAuth` | Current user | 6 |

### Do tokens, alag kaam

Login ke baad server user ko **do tokens** deta hai (httpOnly cookies me):

| | Access token | Refresh token |
|---|---|---|
| Kaam | Har API request me "main ye user hu" proof | Sirf naya access token lene ke liye |
| Life | **15 min** (chhota) | **7 din** (lamba) |
| Kahan jata hai | Har request ke saath | Sirf `/api/auth/*` ke saath |
| Server check kaise karta hai | Sirf signature (DB nahi) | Signature **aur** DB record |
| Revoke ho sakta hai? | Nahi (expire hone tak) | Haan (DB me record hai) |

**Do tokens kyu?** Ek hi lamba token (7 din) rakhein to chori hone pe attacker 7 din use kar sakta hai, aur hum use rok nahi sakte (JWT beech me cancel nahi hota). Do tokens se access token chhota hai (chori ho to max 15 min ka damage), aur refresh token lamba hai par DB me hai, to hum use **kabhi bhi revoke** kar sakte hain.

**JWT kya hai (1 line):** ek signed string `header.payload.signature`. Server ke paas secret hai, wo signature se verify karta hai ki token usi ne banaya hai aur kisi ne badla nahi. Payload **encrypted nahi**, sirf signed hai, isliye usme password/secret kabhi nahi.

### Account ki states

| State | Kaise bana | Password login | Google login | Notes |
|---|---|---|---|---|
| **Unverified password** | `/signup` | **403** `EMAIL_NOT_VERIFIED` | n/a | `emailVerified: false`, koi session nahi |
| **Verified password** | signup + verify link | haan | link ho jata hai (password rehta hai) | `emailVerified: true` |
| **Google-only** | Google login | 401 (password hai hi nahi) | haan | `emailVerified: true`, password "forgot password" se set kar sakta hai |
| **Google + password** | dono | haan | haan | `googleId` aur `passwordHash` dono |

### Poori picture

```
 Browser (React)                          Server (Express)                       MongoDB
 ───────────────                          ────────────────                       ───────
 Google login -> idToken
 POST /api/auth/google {idToken} ───────► Google se verify
                                          user find/create ──────────────────────► users
                                          refresh token ka hash save ────────────► sessions
 ◄─── Set-Cookie: accessToken (15m)
 ◄─── Set-Cookie: refreshToken (7d)

 GET /api/auth/me (cookie) ─────────────► requireAuth: access token verify (DB nahi)
 ◄─── 200 user                            user padho ────────────────────────────► users

 ... 15 min baad ...
 GET /api/auth/me ──────────────────────► access token expired
 ◄─── 401 code=TOKEN_EXPIRED
 POST /api/auth/refresh (cookie) ───────► refresh verify + DB check
                                          purana revoke, naya issue ─────────────► sessions
 ◄─── Set-Cookie: naye dono tokens
 GET /api/auth/me (retry) ──► 200
```

---

## 2. Files ka map

Folder: `virtualui-server/`

```
server.js                      Entry point: env + DB + listen + graceful shutdown
app.js                         Express app factory (cors, body parser, routes, error handlers), listen nahi karta
config/
  env.js                       Saare env variables validate + parse (fail fast)
  db.js                        MongoDB connect / disconnect
  token.js                     JWT banana + verify karna (sirf crypto, DB nahi)
  google.js                    Google ID token verify karna
routes/
  auth.route.js                URL + method ko controller se jodna, middlewares/limiters lagana
controllers/
  auth.controller.js           HTTP layer: request padho, service bulao, response do
services/
  session.service.js           Refresh token ka lifecycle: issue, rotate, revoke (DB logic)
  password.service.js          Password hash / verify (argon2id), length limits, timing-safe dummy verify
  emailToken.service.js        Email verify / reset tokens: create, consume (ek baar)
  mail.service.js              Email bhejna (abhi console transport: link terminal me print hota hai)
middlewares/
  auth.middleware.js           requireAuth (kaun ho?), requireRole (permission hai?)
  rateLimit.middleware.js      authLimiter, loginLimiter, refreshLimiter, emailActionLimiter, credentialChangeLimiter
  error.middleware.js          Central error handler + 404
models/
  user.model.js                User schema
  session.model.js             Refresh token records
  emailToken.model.js          Verify / reset token records (hashed)
utils/
  ApiError.js                  Status code wala custom error
  cookies.js                   Cookies set/clear (ek jagah options)
docs/AUTH_FLOW.md              Ye document
.env / .env.example            Secrets / config
```

### Layering rule (ye follow karna)

```
routes  ->  controllers  ->  services  ->  models / config
(URL)       (HTTP)           (business     (DB, JWT, Google)
                              + security
                              logic)
```

- **Route** sirf batata hai "ye URL -> ye controller, ye middlewares".
- **Controller** HTTP ki baat karta hai (`req`, `res`, cookies, status code). Logic patla rakho.
- **Service** me asli logic hai (kya DB me save karna hai, kab revoke karna hai). Isme `req/res` nahi hote, isliye reuse aur test aasan.
- **Config / model** sabse neeche: JWT banana, DB schema, Google call.
- Neeche wali layer upar wali ko import **nahi** karti (service controller ko import nahi karta).

### Kaun kisko use karta hai

```
routes/auth.route.js ─► middlewares/{auth, rateLimit}
        │
        └► controllers/auth.controller.js ─┬► config/google.js
                                           ├► services/session.service.js ───► config/token.js, models/session.model.js, models/user.model.js
                                           ├► services/password.service.js ──► argon2
                                           ├► services/emailToken.service.js ► models/emailToken.model.js
                                           ├► services/mail.service.js ──────► config/env.js (CLIENT_URL)
                                           ├► models/user.model.js
                                           ├► utils/cookies.js
                                           └► utils/ApiError.js

server.js ─► app.js ─► (cors, json, cookieParser, routes, notFound, errorHandler)
        ├► config/env.js   (sab config files isse padhti hain)
        └► config/db.js
```

---

## 3. Startup flow

`npm run dev` -> `nodemon server.js` -> `server.js`:

```js
import 'dotenv/config';                 // 1) .env load
import env from './config/env.js';      // 2) env validate (galat ho to yahin crash)
await connectToDb();                    // 3) DB connect (fail ho to server start nahi)
const server = createApp().listen(PORT) // 4) phir traffic lena shuru
// 5) SIGINT/SIGTERM pe graceful shutdown
```

1. `dotenv/config` sabse upar: ESM me imports hoist hote hain (file ke code se pehle chalte hain), isliye `.env` ko side-effect import se load karte hain. (`config/env.js` me bhi ye import hai, to order pe depend nahi karna padta.)
2. **`config/env.js` fail-fast:** saare variables ek jagah validate hote hain. Missing/weak secret ho to server **start hote hi** band, saari galtiyan ek saath dikhti hain:
   ```
   Invalid environment configuration:
    - GOOGLE_CLIENT_ID is required
    - JWT_SECRET must be at least 32 characters
   ```
3. **Pehle DB, phir listen:** DB ke bina server traffic le to har request fail hogi.
4. **`createApp()`** (`app.js`) sirf app banata hai, `listen` nahi. Tests me bina port khole app chal sakta hai.
5. **Graceful shutdown:** Ctrl+C / Docker stop pe naye connections band, chal rahi requests poori, phir DB close, phir exit.

---

## 4. Ek request ka safar

`app.js` me middlewares ka **order** hi pipeline hai:

```js
app.disable('x-powered-by');                           // framework ka naam chhupao
app.set('trust proxy', env.TRUST_PROXY);               // (optional) proxy ke peeche asli IP ke liye
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));   // frontend ko cookies ke saath allow
app.use(express.json({ limit: '10kb' }));              // JSON body parse (bade body reject)
app.use(cookieParser());                               // req.cookies bharo
app.get('/', healthCheck);
app.use('/api/auth', authRouter);                      // routes
app.use(notFoundHandler);                              // koi route match nahi -> 404 JSON
app.use(errorHandler);                                 // koi bhi error -> ek jaisa JSON (HAMESHA last)
```

- **CORS:** frontend alag origin/port pe ho to browser cookies ke saath request tabhi bhejta hai jab server explicitly allow kare. `origin` sirf hamara frontend (`CLIENT_URL`), `"*"` nahi (cookies ke saath wo chalta hi nahi, aur unsafe hai). `credentials: true` se cookies jati hain.
- `express.json()` aur `cookieParser()` routes se **pehle**, warna `req.body` / `req.cookies` khali milenge.
- `errorHandler` **last** me, taaki saare errors yahan aayein. Express 5 me async handler ka `throw` **apne aap** yahan pahunchta hai, controllers me `try/catch` nahi chahiye.

---

## 5. Andar aane ke flows

### 5.1 Google login

**Endpoint:** `POST /api/auth/google`   **Body:** `{ "idToken": "<Google ka token>" }`

```
Browser                 Express                   Google              MongoDB
  │ Google Sign-In        │                         │                    │
  │ ───────────────────────────────────────────────►│
  │ ◄─────────────────────────────────────────────── idToken (Google ne sign kiya)
  │ POST /google {idToken}│                         │                    │
  │ ─────────────────────►│ 1. authLimiter (rate limit check)            │
  │                       │ 2. validate: idToken string hai?             │
  │                       │ 3. verifyIdToken ──────►│ signature, expiry, │
  │                       │ ◄────────────────────── │ audience check     │
  │                       │ 4. email_verified true?                      │
  │                       │ 5. user find / create ───────────────────────► users
  │                       │ 6. issueSession: 2 tokens ───────────────────► sessions
  │ ◄─────────────────────│ 7. Set-Cookie x2 + JSON {user}               │
```

1. **Rate limit:** `authLimiter`, ek IP se 15 min me max 100 requests (signup/login/google). 100 isliye: office/NAT ke peeche kai log ek hi IP se aate hain.
2. **Validation:** `typeof idToken !== 'string'` pe 400. Object bheja to NoSQL injection ka risk.
3. **Google verify** (`config/google.js`):
   ```js
   const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
   ```
   Library Google ki public keys se signature, expiry, issuer check karti hai. **`audience` check** zaroori hai, warna kisi doosri app ke liye bana Google token bhi chal jata. Fail pe generic `401 Invalid Google token`.
   > **Sabse important rule:** email/name **kabhi** `req.body` se mat lo. Hamesha Google ke verified token ke payload se lo.
4. **`email_verified`** false ho to reject.
5. **User find / create:**
   ```js
   const email = profile.email.trim().toLowerCase();
   let user = await User.findOne({ email });
   if (!user) {
       try { user = await User.create({ name, email, googleId, emailVerified: true }); }
       catch (error) { if (error.code !== 11000) throw error; user = await User.findOne({ email }); }  // race condition
   }
   ```
   Naya Google user `emailVerified: true` ke saath banta hai. Pehle se email se bana account ho to linking hoti hai (5.5).
6. **Session issue** (`issueSession`): access + refresh tokens, refresh ka **hash** DB me (raw nahi), `family` = is login ki pehchaan (reuse detection, section 8).
7. **Response:** cookies + `toPublicUser(user)` (sirf `id, name, email, role, aiCredits, emailVerified`; poora DB document kabhi nahi). Naya user `201`, existing `200`.

### 5.2 Email signup

**Endpoint:** `POST /api/auth/signup`   **Body:** `{ "name", "email", "password" }`

```
Browser                 Express                                   MongoDB
  │ POST /signup          │ 1. authLimiter                           │
  │ ─────────────────────►│ 2. validate name / email / password      │
  │                       │ 3. hashPassword (argon2id)               │
  │                       │ 4. User.create({passwordHash,            │
  │                       │       emailVerified:false}) ─────────────► users (unique email)
  │                       │    E11000? -> 409 EMAIL_TAKEN            │
  │                       │ 5. verification token + mail ────────────► emailtokens
  │ ◄─────────────────────│ 6. 201 {user}  (NO cookies)              │
```

**Dhyan dene wali baat: signup ke baad user login NAHI hota.** Koi cookie/token nahi milta. Pehle email verify karni padti hai (5.3), tabhi login chalta hai. Isse koi kisi aur ka email use karke account bana ke use nahi kar sakta.

1. **Validation** (`typeof` checks pehle, NoSQL injection / crash se bachav):
   - `name`: string, non-empty, max 100
   - `email`: string, format check
   - `password`: string, **min 8, max 128**. Max isliye ki bahut lamba password hashing me CPU/memory kha ke DoS kar sakta hai. Composition rules (1 capital, 1 symbol) nahi lagaye: NIST bhi discourage karta hai. Password **trim nahi** hota.
2. **Hash** (`services/password.service.js`): `argon2.hash(password)`.
   - **Argon2id kyu:** OWASP ka first-choice. Jaan-boojh ke slow aur memory-hungry (64 MiB), taaki DB leak ho to bhi attacker ka har guess mehenga pade. SHA-256/MD5 password ke liye **galat** hain (fast hain, billions guesses/sec).
   - Salt library khud random banati hai, hash string me hi rehta hai: `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`. Alag salt field nahi.
   - Plain password kahin store/log/response me nahi jata.
3. **Create:** seedha `User.create`, pehle `findOne` check nahi (race condition: do requests ek saath dono pass ho jati). Unique email index duplicate pakadta hai -> `409 EMAIL_TAKEN`.
   > Email pehle se ho (password se bana ho ya Google se) to signup **kuch change nahi karta**, sirf 409. Agar Google-only account pe signup se password set ho jata, to koi bhi kisi ke Google account me apna password jod deta. Agar user ne verification email miss kar di thi to `/resend-verification` use kare.
4. **Verification email:** token banta hai aur mail service se jata hai (5.3 aur section 11). Mail fail ho to bhi signup **successful** rehta hai (best effort), error sirf server log me.
5. **Response:** `201`, `data.emailVerified: false`, **cookies nahi**.

### 5.3 Email verification

**Poora flow:**

```
signup ──► token banta hai ──► mail (link) ──► user link kholta hai ──► frontend page ──► POST /verify-email {token}
                                                                                           │
                                                      emailVerified = true, token delete ◄─┘
```

Link ka format: `${CLIENT_URL}/verify-email?token=<token>` (frontend ka page). Abhi mail ki jagah **link server console me print hota hai** (section 11):

```
================= [DEV MAIL] =================
To:      demo@example.com
Subject: Verify your email
----------------------------------------------
Hi Demo,

Email verify karne ke liye ye link kholo (24 ghante tak valid):
http://localhost:5173/verify-email?token=iHr1QRB8km_oq2l59xF0z0gGgKWmAos63h1_XwaOuwU
...
```
Development me wo link copy karke seedha `POST /api/auth/verify-email {token}` kar sakte ho (ya frontend page banne ke baad browser me kholo).

#### `POST /api/auth/verify-email`   Body: `{ "token" }`

```js
const userId = await consumeEmailToken(token, EMAIL_TOKEN_TYPES.VERIFY_EMAIL);
if (!userId) throw new ApiError(400, 'Invalid or expired verification link', 'INVALID_TOKEN');
await User.updateOne({ _id: userId }, { $set: { emailVerified: true } });
```

- **Token ek baar hi chalta hai** (consume = DB se delete). Dobara use pe `400`.
- **Invalid / expired / pehle use hua / galat type**, sab ke liye ek jaisa `400 INVALID_TOKEN` (wajah nahi batate).
- **POST hai, GET nahi:** email security scanners / link previews links ko khud khol dete hain. GET pe verify hota to user ke click kiye bina hi verify ho jata. POST pe nahi hota.
- **Verify ke baad auto-login nahi:** link forward/leak ho jaye to bhi koi bina password ke andar nahi aa sakta. User ko ab login karna hai.
- Verify token se **reset token** use nahi ho sakta (type alag), aur galat type pe token consume bhi nahi hota.

#### `POST /api/auth/resend-verification`   Body: `{ "email" }`

Naya link bhejta hai (**purana link band**, sirf naya chalta hai). Rules:

- **Hamesha ek jaisa `200`**, body bhi same: email registered ho ya na ho, verified ho ya na ho. Warna ye endpoint "kaunsa email registered hai" batane ka zariya ban jata (user enumeration).
- Kaam **background me** hota hai (response ke baad). Wait karte to "email exist karta hai" wale case me DB write + mail ka extra time lagta, aur response time se attacker pata laga leta (timing leak).
- **`emailActionLimiter`:** ek IP + email ke liye ghante me max 5. Warna koi kisi ke inbox me baar-baar mail bhej ke use spam kar sakta hai (email bombing).
- Mail sirf tab jati hai jab user hai aur `emailVerified` false hai.

### 5.4 Email login

**Endpoint:** `POST /api/auth/login`   **Body:** `{ "email", "password" }`
**Route:** `authLimiter -> loginLimiter -> login`

```js
const user = await User.findOne({ email }).select('+passwordHash');   // select:false field explicitly mangi
let isValid = false;
if (user?.passwordHash) isValid = await verifyPassword(user.passwordHash, password);
else await verifyAgainstDummy(password);                              // timing barabar rakhne ke liye
if (!isValid) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
if (!user.emailVerified) throw new ApiError(403, 'Please verify your email before signing in', 'EMAIL_NOT_VERIFIED');
```

Rules (ye follow karna):

1. **User enumeration nahi:** galat email, galat password, aur Google-only account (jiska password hi nahi), **teeno pe ek jaisa** `401 INVALID_CREDENTIALS`, ek jaisa message.
2. **Timing attack nahi:** email na mile tab bhi **dummy hash pe verify** chalta hai, dono cases me lagbhag same time (test me ~65ms vs ~65-90ms).
3. **Email verified hona zaroori:** `403 EMAIL_NOT_VERIFIED`. Ye check password **sahi hone ke baad** hota hai, taaki galat password wale ko ye pata na chale ki account verified hai ya nahi. Frontend is code pe "resend verification" ka button dikhaye.
4. **Brute-force:** `loginLimiter` (neeche).
5. **Rehash on login:** agar future me argon2 ke parameters badhayein, `needsRehash(hash)` true hota hai aur login pe (jab plain password hamare paas hota hai) hash naye params se dobara ban jata hai. Purane hashes dheere-dheere upgrade hote hain.

**`loginLimiter` (brute-force):**
- Key = **IP + email**. Ek IP se ek account pe 15 min me max **10 galat attempts**, 11th pe `429`.
- `skipSuccessfulRequests`: sahi login count nahi hota.
- `authLimiter` (sirf IP) iske **saath** lagta hai, iski jagah nahi: sirf IP+email pe limit hoti to attacker alag-alag emails try karta (credential stuffing) aur bach jata.
- Limitation: kai alag IPs se ek account pe attack (distributed) isse nahi rukta (account lockout / CAPTCHA chahiye).

Success ke baad `issueSession` + cookies, response `200`.

### 5.5 Account linking aur pre-hijacking

Ek hi email Google aur password dono se aa sakta hai. Isme ek **real attack** hai jo handle kiya gaya hai.

**Attack (pre-hijacking):**
1. Attacker `victim@gmail.com` ko apne password ke saath **signup** karta hai.
2. Baad me asli victim "Sign in with Google" karta hai, wahi email.
3. Agar hum bas Google id attach kar dein, to **attacker ka password us account me chalta rahta hai**.

**Do layers of defense:**

1. **Email verification:** attacker ka account tab tak verified nahi jab tak victim ke inbox ka link click na ho. Unverified account se login hi nahi hota, to attacker andar nahi aa sakta.
2. **Google link pe cleanup** (`googleAuth` me): agar victim ka Google login us unverified account se mile (`googleId` nahi), to:
   ```js
   if (!user.emailVerified) {
       user.set('passwordHash', undefined);          // attacker ka password hatao
       await revokeAllUserSessions(user._id);        // koi purana session ho to band
   }
   user.googleId = profile.googleId;
   user.emailVerified = true;
   await user.save();
   await deleteUserEmailTokens(user._id);            // purane verify/reset links bekaar
   ```

| Situation | Kya hota hai |
|---|---|
| Password signup, email pehle se hai (Google ya password) | **409**, kuch change nahi |
| Google login, email pe **unverified** password account | Google link, **password hat jata hai**, links aur sessions saaf |
| Google login, email pe **verified** password account | Google link hota hai, **password rehta hai** (dono se login) |
| Google-linked account pe password login | `401` (password hai hi nahi, jab tak "forgot password" se set na kare) |
| Google login, `googleId` alag | `401 GOOGLE_ACCOUNT_MISMATCH` |

---

## 6. Protected request

**Example:** `GET /api/auth/me`. Route: `authRouter.get('/me', requireAuth, me)`.

```
Browser ──(Cookie: accessToken=...)──► requireAuth ──► me controller ──► users (DB)
```

`requireAuth` (`middlewares/auth.middleware.js`):

```js
const token = req.cookies?.accessToken;
if (!token) throw new ApiError(401, 'Authentication required', 'NO_TOKEN');
try {
    const payload = verifyAccessToken(token);          // signature + expiry + iss + aud
    req.auth = { userId: payload.sub, role: payload.role, tokenId: payload.jti };
    next();
} catch (error) {
    if (error.name === 'TokenExpiredError') throw new ApiError(401, 'Access token expired', 'TOKEN_EXPIRED');
    throw new ApiError(401, 'Invalid access token', 'INVALID_TOKEN');
}
```

- **DB hit nahi:** access token **stateless** hai, signature se hi proof ho jata hai. Har request pe fast.
- `req.auth` baad ke handlers ke liye hai (`req.auth.userId`, `req.auth.role`).
- `TOKEN_EXPIRED` alag code hai: frontend ise dekh ke chupchap `/refresh` call karta hai.
- `/me` DB se **fresh** user padhta hai (token ka data 15 min tak purana ho sakta hai).

### Authentication vs Authorization

| | Sawal | Middleware | Fail hone pe |
|---|---|---|---|
| Authentication | Tum **kaun** ho? | `requireAuth` | **401** |
| Authorization | Tumhe **permission** hai? | `requireRole('ADMIN')` | **403** |

```js
export const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!allowedRoles.includes(req.auth.role)) throw new ApiError(403, '...', 'FORBIDDEN');
    next();
};
```
`requireRole` hamesha `requireAuth` ke **baad** lagta hai (`req.auth` wahi set karta hai). Factory function hai, taaki alag routes pe alag roles de sako.

---

## 7. Refresh (rotation)

15 min baad access token expire ho jata hai:

```
GET /me ──► 401 { code: "TOKEN_EXPIRED" }
POST /refresh (refreshToken cookie) ──► 200 + naye dono tokens
GET /me (retry) ──► 200
```

`rotateSession` (`services/session.service.js`):

```
1. refresh JWT verify         (signature, expiry, iss, aud=refresh)         ──fail──► 401
2. DB me jti se Session dhundo, hash match karo (timing-safe compare)      ──fail──► 401
3. session.revokedAt hai? ──► REUSE! poori family revoke                    ─────────► 401   (section 8)
4. Atomically purana revoke karo (updateOne revokedAt:null -> now)
   modifiedCount != 1 ? ──► koi parallel request jeet gayi, REUSE maano    ─────────► 401
5. User exist karta hai? Email verified hai (ya Google-linked)? nahi        ─────────► family revoke, 401
6. issueSession(user, meta, SAME family) -> naya access + naya refresh
7. purane session pe replacedBy = naya jti (audit trail)
```

**Rotation kyu:** refresh token ek baar hi use ho sakta hai. Har refresh pe naya milta hai, purana turant revoke. Isse chori hua token zyada der kaam ka nahi rehta, aur reuse pakda ja sakta hai.

**Atomic claim (step 4):**

```js
const claimed = await Session.updateOne(
    { _id: session._id, revokedAt: null },       // filter me revokedAt:null
    { $set: { revokedAt: new Date() } },
);
if (claimed.modifiedCount !== 1) { /* doosri request pehle pahunchi */ }
```
Do requests same token se ek saath aayein to DB sirf ek ko update karne deta hai. Pehle `findOne` phir `update` karte to dono pass ho jati.

**Step 5 ka email-verified check:** unverified password user ko login pe session milta hi nahi, par agar kisi ke paas purana session ho to refresh pe band ho jata hai. Google-linked user verified maana jata hai (`googleId` hai), chahe `emailVerified` field purana ho.

Controller (`refresh`) 401 hone pe browser ki ab-bekaar cookies bhi clear kar deta hai. `/refresh` ka alag, udaar limiter hai (`refreshLimiter`, 300/15 min per IP): har user ka browser har ~15 min me refresh karta hai, office IP ke peeche kai users hon to normal traffic hai.

---

## 8. Reuse detection

**Idea:** rotation me har refresh token **ek hi baar** valid hai. Agar koi **purana (already use ho chuka)** token bheje, to do log (asli user + attacker) ek hi token ki copies use kar rahe hain, yaani token **chori** hua.

```
Time ──────────────────────────────────────────────────────────────►

 Asli user:   login ─► R1 ──refresh──► R2 ──refresh──► R3 ...
 Attacker:    (R1 chura leta hai)
                                     R1 bhejta hai ──► DB: R1 pehle se revoked!
                                                       ► REUSE DETECTED
                                                       ► family ke saare tokens (R2, R3) revoke
                                                       ► 401 dono ko
                                                       ► asli user ko dobara login karna padega
```

```js
if (session.revokedAt) {
    await revokeFamily(session.family);   // is login ki poori chain revoke
    throw unauthorized();
}
```

- **Family** = ek login se bani poori rotation chain. Poori family revoke karne se attacker ke paas jo bhi latest token hai wo bhi mar jata hai.
- Trade-off: asli user ko dobara login karna padta hai, par account safe rehta hai.

---

## 9. Logout

### `POST /api/auth/logout` (ek device)

```js
const refreshToken = req.cookies?.refreshToken;
if (refreshToken) await revokeSessionByToken(refreshToken);   // DB me family revoke
clearAuthCookies(res);                                         // browser se cookies hatao
return res.status(200).json(...);                              // HAMESHA 200
```

- **Asli logout:** DB me revoke hota hai, to token kabhi kaam nahi karega (sirf cookie hatane se 7 din valid rehta).
- `requireAuth` **nahi** lagaya: access token expire ho chuka ho tab bhi user logout kar sake.
- **Idempotent:** pehle se logout ho to bhi `200`.
- **POST** hai, GET nahi: state change GET se nahi hona chahiye (`<img src=".../logout">` se chupke se logout/CSRF, browser prefetch).

### `POST /api/auth/logout-all` (saare devices)

```js
router.post('/logout-all', requireAuth, logoutAll);
await Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
```
Account compromise ka shak ho to user ke **saare** active sessions revoke. `requireAuth` chahiye.

> Jo access tokens already issue ho chuke hain wo expire hone tak (max 15 min) chalenge (stateless hain). Refresh tokens turant mar jate hain, isliye 15 min baad poora access band.

---

## 10. Password management

Teen flows hain, teeno me sessions ka dhyan rakha gaya hai.

### `POST /api/auth/forgot-password`   Body: `{ "email" }`

```
user ──email──► forgot-password ──► (background) reset token + mail ──► user link kholta hai ──► frontend page ──► POST /reset-password
```

- **Hamesha ek jaisa `200`** (email registered ho ya na ho), aur kaam **background me**: email enumeration aur timing dono se bachav (jaise resend-verification).
- **Google-only account ko bhi link jata hai:** wahi uska tareeka hai pehla password set karne ka (email ka malik hona hi proof hai).
- `emailActionLimiter`: IP + email pe ghante me 5.
- Reset token **1 ghante** ka (verify token 24 ghante ka). Reset zyada sensitive hai, isliye jaldi expire.
- Link: `${CLIENT_URL}/reset-password?token=<token>`.

### `POST /api/auth/reset-password`   Body: `{ "token", "password" }`

Steps (order important hai):

```js
assertValidPassword(password);                                   // 1. pehle validate
const passwordHash = await hashPassword(password);                // 2. hash (token consume se PEHLE)
const userId = await consumeEmailToken(token, RESET_PASSWORD);    // 3. token ek baar consume
await User.updateOne({ _id: userId }, { $set: { passwordHash, emailVerified: true } });   // 4. password set + verified
await deleteUserEmailTokens(userId);                              // 5. baaki email tokens saaf
await revokeAllUserSessions(userId);                              // 6. SAARE sessions revoke
clearAuthCookies(res);
```

- **Validate/hash pehle, consume baad me:** user ne weak password dala to token waste nahi hota, wo naya password daal ke dobara try kar sakta hai.
- **`emailVerified: true`:** reset link email ke inbox me gaya tha, yani malik ne hi kholi. Isse unverified user bhi reset se verified ho jata hai.
- **Saare sessions revoke:** password isi liye to badla jata hai ki koi (attacker bhi) pehle se logged-in ho to nikal jaye.
- **Login nahi karata:** user ko ab naye password se login karna hai (link leak hone pe bhi koi direct andar nahi aata).
- Token ek baar hi chalta hai, expired/invalid pe `400 INVALID_TOKEN`.

### `POST /api/auth/change-password`   (requireAuth)   Body: `{ "currentPassword", "newPassword" }`

Logged-in user password badalta hai.

- **Current password maangte hain:** kisi ka access token chori ho jaye to bhi attacker bina purane password ke password nahi badal sakta.
- Errors (sab 400): `INVALID_CURRENT_PASSWORD`, `SAME_PASSWORD` (naya = purana), `VALIDATION_ERROR` (weak), `NO_PASSWORD_SET`.
- **`NO_PASSWORD_SET`:** Google-only account ke paas password hi nahi, unhe "forgot password" se pehla password set karna hota hai (re-auth ke bina set-password allow karte to chori hue access token se attacker permanent password laga leta).
- **Sessions:** baaki **saare devices ke sessions revoke**, is device ke liye **naya session** (user yahin logged in rehta hai).
- **`credentialChangeLimiter`:** IP + userId pe 15 min me 10 galat attempts (`requireAuth` ke baad lagta hai, taaki `req.auth.userId` mile). Chori hue token se current password guess karne se rokta hai.

---

## 11. Email tokens aur Mail service

### Email tokens (`models/emailToken.model.js`, `services/emailToken.service.js`)

Email verification aur password reset ka mechanism **same** hai, isliye ek hi model/service:

| | VERIFY_EMAIL | RESET_PASSWORD |
|---|---|---|
| Life | 24 ghante | 1 ghanta |
| Link | `${CLIENT_URL}/verify-email?token=...` | `${CLIENT_URL}/reset-password?token=...` |
| Consume pe | `emailVerified = true` | password set, sessions revoke |

```js
const token = randomBytes(32).toString('base64url');   // email me ye jata hai (256-bit random)
tokenHash = sha256(token);                              // DB me sirf hash
```

- **JWT nahi, random token + DB record:** DB me hai, to hum use kabhi bhi delete/invalidate kar sakte hain (ek baar use hone pe, ya naya link maangne pe). JWT beech me cancel nahi hota.
- **Hash store:** DB leak ho to bhi koi link use nahi kar sakta. SHA-256 yahan theek hai (argon2 nahi): token already 256-bit random hai, brute-force possible hi nahi.
- **`createEmailToken`:** us user ke us type ke purane tokens delete karta hai (resend pe sirf naya link chalta hai).
- **`consumeEmailToken`:** record dhundo (hash + type + expiry), phir `deleteOne` aur `deletedCount === 1` check (atomic claim: do requests ek saath to sirf ek jeetti hai). Invalid/expired/reuse/galat type: sab pe `null`.
- TTL index se expire hote hi MongoDB record khud delete kar deta hai.

### Mail service (`services/mail.service.js`)

Abhi sirf **console transport** hai: email bhejne ki jagah link terminal me print hota hai (upar 5.3 me example).

```js
sendVerificationEmail({ to, name, token })
sendPasswordResetEmail({ to, name, token })
```

- Baaki app sirf in functions ko bulata hai. **Asli provider** (Resend, SendGrid, SES, SMTP) lagana ho to `transport` function badalna hai (`setMailTransport(fn)`), flows ko kuch nahi badalna.
- **Production me console transport band:** verify/reset links logs me print hona khatarnak hai (logs padhne wala koi bhi account hijack kar sakta hai). `NODE_ENV=production` me ye transport error throw karta hai, link print nahi hota. **Production deploy se pehle asli mail transport lagana zaroori hai.**
- **Best effort:** mail fail ho (provider down, config nahi) to signup/forgot ka flow nahi tootta aur client ko pata nahi chalta (warna email existence leak). Error sirf server log me (`[mail] ... failed`). User `resend` se dobara maang sakta hai.
- **Background:** forgot/resend me kaam response ke baad chalta hai (timing leak se bachav). Production me asli provider ke saath ye kaam queue (BullMQ etc.) me jana chahiye.

---

## 12. Tokens ke andar kya hai

`config/token.js` me banate/verify hote hain.

**Access token** payload:

```json
{
  "sub": "665f...userId",
  "role": "USER",
  "iss": "virtualui-server",
  "aud": "virtualui:access",
  "jti": "unique-id",
  "iat": 1760000000,
  "exp": 1760000900
}
```

**Refresh token** payload: same, par `role` nahi, aur `aud: "virtualui:refresh"`.

| Claim | Matlab | Kyu |
|---|---|---|
| `sub` | Subject: token kis user ka hai | Standard claim |
| `iss` | Issuer: kisne banaya | Verify pe check: dusre server ka token reject |
| `aud` | Audience: kis kaam ke liye | **Access aur refresh alag**, taaki refresh token ko access ki tarah use na kiya ja sake (token confusion attack) |
| `jti` | JWT id: unique | Refresh token ko DB me track/revoke karne ke liye |
| `iat` / `exp` | Issued at / Expiry | Library khud lagati hai |
| `role` | User ka role | `requireRole` bina DB ke check kare |

**Role token me kyu:** `requireRole` ko DB hit na karna pade. Trade-off: role badalne pe naya role max 15 min baad lagega.

**Verify me teen cheezein pin hain:**

```js
jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'virtualui-server', audience: 'virtualui:access' });
```
`algorithms` pin na ho to attacker header me `alg: none` ya doosra algorithm daal ke bypass try karta hai (algorithm confusion).

**Signing algorithm:**
- **HS256 (default):** ek shared secret sign aur verify dono. Access (`JWT_SECRET`) aur refresh (`JWT_REFRESH_SECRET`) ke secrets **alag** (ek leak ho to doosra safe).
- **RS256 (optional, `JWT_ALGORITHM=RS256`):** private key se sign, public key se verify. Tab kaam aata hai jab alag services token verify karein. Header me `kid` (key id) hota hai, **key rotation** ke liye:

```
nayi key:  JWT_KEY_ID=k2, JWT_PRIVATE_KEY/JWT_PUBLIC_KEY = nayi
purani:    JWT_PREVIOUS_PUBLIC_KEYS={"k1":"<purani public key>"}
```
Naye tokens `k2` se sign hote hain, purane (`k1`) tokens expire hone tak verify hote rahte hain. Sab purane expire hone ke baad `k1` hata do.

---

## 13. Cookies

`utils/cookies.js` me ek jagah define hain:

| Cookie | Path | MaxAge | Kyu |
|---|---|---|---|
| `accessToken` | `/` | 15 min | Har API request ke saath |
| `refreshToken` | `/api/auth` | 7 din | Sirf `/refresh` aur `/logout` ke saath jata hai |

```js
const baseOptions = { httpOnly: true, secure: env.isProduction, sameSite: 'lax' };
```

- **`httpOnly`:** JavaScript cookie padh nahi sakti. XSS attack me bhi token chori nahi hota. (localStorage me token rakhna XSS me seedha chori ho jata hai.)
- **`secure`:** production me cookie sirf HTTPS pe jati hai.
- **`sameSite: 'lax'`:** dusri site se aayi cross-site POST requests me cookie nahi jati (CSRF se bachav).
- **Refresh ka path chhota:** wo baaki API requests ke saath nahi jata. Exposure kam = chori ka chance kam.
- **`clearCookie` ko set ke same options chahiye** (path, sameSite, secure, httpOnly), warna browser cookie delete nahi karta. Isliye options ek constant me hain.
- Frontend alag domain pe ho to `sameSite: 'none'` + `secure` + CSRF protection chahiye (limitations dekho).

---

## 14. Database models

### `User` (`models/user.model.js`)

| Field | Detail |
|---|---|
| `name` | required, trim, max 100 |
| `email` | required, trim, **lowercase**, format check, **unique index** |
| `passwordHash` | Argon2id hash. **`select: false`**: normal queries me aata hi nahi (leak nahi), login me `.select('+passwordHash')`. Google-only users ke paas nahi hota |
| `emailVerified` | Email ka malik hone ka proof. Google se `true`, password signup me `false`, verify link / reset se `true`. Password login iske bina nahi chalta |
| `googleId` | Google ki `sub`. Optional par unique (partial index: sirf string wale docs) |
| `role` | `ADMIN` / `USER`, default `USER` (`ROLES` constant export hota hai) |
| `aiCredits` | default 150, min 0 |

### `Session` (`models/session.model.js`): ek refresh token = ek record

| Field | Kaam |
|---|---|
| `user` | Kis user ka |
| `jti` (unique) | Refresh JWT ki id; lookup isi se |
| `family` (index) | Ek login se bani poori rotation chain |
| `tokenHash` | Token ka SHA-256. Raw token DB me nahi |
| `expiresAt` | Expiry. **TTL index** se MongoDB expire hote hi record khud delete kar deta hai |
| `revokedAt` | `null` = active; date = revoke (rotate/logout/reuse/password change) |
| `replacedBy` | Rotation me iski jagah kaunsa naya `jti` bana (audit trail) |
| `userAgent`, `ip` | Kis device/IP se (aage "active devices" screen ke kaam aayega) |

### `EmailToken` (`models/emailToken.model.js`): verify / reset tokens

| Field | Kaam |
|---|---|
| `user` | Kis user ka |
| `type` | `VERIFY_EMAIL` ya `RESET_PASSWORD` |
| `tokenHash` (unique) | Token ka SHA-256. Raw token sirf email me jata hai |
| `expiresAt` | 24h (verify) / 1h (reset). **TTL index** se auto delete |

Indexes: Session `jti` unique, `family`, `{user, revokedAt}`, `expiresAt` TTL. EmailToken `tokenHash` unique, `{user, type}`, `expiresAt` TTL.

---

## 15. Error handling aur status codes

**Pattern:** jahan error ho wahan `throw new ApiError(status, message, code)`. Central handler (`middlewares/error.middleware.js`) ek jaisa response banata hai:

```json
{ "status": false, "message": "Access token expired", "code": "TOKEN_EXPIRED" }
```

- `message` insaan ke liye, `code` **frontend ke code** ke liye (message badal sakta hai, code fix rehta hai).
- Expected error (`ApiError`): jo message diya wahi jata hai.
- **Unexpected error:** poora error sirf server log me; client ko generic `500`. Stack/internals kabhi leak nahi karte.
- Handler ye bhi map karta hai: bad JSON `400`, badi body `413`, Mongoose validation `400`, **galat id format (`CastError`) `400 INVALID_ID`**, **unique index violation (`E11000`) `409 DUPLICATE`**.

| Status | Kab | `code` examples |
|---|---|---|
| 400 | Galat input / invalid token | `VALIDATION_ERROR`, `BAD_JSON`, `INVALID_TOKEN` (verify/reset link), `INVALID_CURRENT_PASSWORD`, `SAME_PASSWORD`, `NO_PASSWORD_SET`, `INVALID_ID` |
| 401 | Authenticated nahi | `NO_TOKEN`, `INVALID_TOKEN` (access token), `TOKEN_EXPIRED`, `NO_REFRESH_TOKEN`, `INVALID_GOOGLE_TOKEN`, `GOOGLE_EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`, `GOOGLE_ACCOUNT_MISMATCH` |
| 403 | Authenticated hai, par allowed nahi | `FORBIDDEN` (role), **`EMAIL_NOT_VERIFIED` (password login, frontend pe "resend" button)** |
| 404 | Route nahi mila | `NOT_FOUND` |
| 409 | Email pehle se registered / duplicate | `EMAIL_TAKEN`, `DUPLICATE` |
| 413 | Body 10kb se badi | `BODY_TOO_LARGE` |
| 429 | Rate limit | `RATE_LIMITED` |
| 500 | Unexpected | `INTERNAL_ERROR` |

**401 vs 403:** 401 = "tum kaun ho pata nahi / credentials galat". 403 = "tum kaun ho pata hai, par abhi allowed nahi" (role galat, ya email verify nahi hui).
> `INVALID_TOKEN` do jagah aata hai: **access token** galat ho to `401`, **email link ka token** galat ho to `400`. Status code dekh ke farak pata chalta hai.

---

## 16. Security decisions

| Decision | Kyu |
|---|---|
| Google ID token server pe verify, `audience` check | Client ke data pe trust nahi; dusri app ka token accept na ho |
| `typeof` input checks | NoSQL injection roke |
| Access 15 min, refresh 7 din | Chori ka damage limited, par user baar-baar login na kare |
| Alag secrets (HS256), alag `aud` | Ek leak ho to doosra safe; refresh ko access ki tarah use nahi kar sakte |
| Algorithm / issuer / audience pin | Algorithm confusion aur dusre issuer ke tokens se bachav |
| Refresh token DB me, hash karke | Revoke possible; DB leak se token use nahi |
| Rotation + reuse detection + atomic `updateOne` | Chori pakdi jati hai, parallel refresh me race nahi |
| `httpOnly`, `sameSite: lax`, POST logout, chhota refresh path | XSS/CSRF se bachav, exposure kam |
| CORS allowlist (`CLIENT_URL`) + credentials | Sirf hamara frontend cookies ke saath request kar sake |
| Argon2id password hash | DB leak ho to bhi guess karna mehenga (SHA/MD5 galat) |
| Password 8 se 128 chars | NIST guideline; lambe password se hashing DoS nahi |
| `passwordHash` `select: false`, `toPublicUser` | Galti se response/log me leak na ho |
| Login pe ek jaisa error + dummy hash verify | User enumeration aur timing attack se bachav |
| **Email verification (login se pehle)** | Koi kisi aur ka email use karke account nahi chala sakta |
| `403 EMAIL_NOT_VERIFIED` password sahi hone ke BAAD | Galat password wale ko verification state pata na chale |
| Verify link POST, auto-login nahi | Email scanners link khol dein to bhi verify/login na ho |
| Email tokens random + hash + one-time + expiry | Link chori/DB leak/reuse se bachav |
| Forgot/resend: ek jaisa 200 + background | Email enumeration aur timing leak nahi |
| Mail best-effort, console transport production me band | Mail fail se flow na tute; logs me link leak na ho |
| `emailActionLimiter` (IP+email, 5/ghanta) | Email bombing / spam nahi |
| Reset: validate pehle, consume baad me; saare sessions revoke | User ka token waste na ho; attacker pehle se logged-in ho to nikle |
| Change password: current password + baaki sessions revoke | Chori hue access token se password na badle |
| `credentialChangeLimiter` (IP+userId) | Chori hue token se current password guess na ho |
| Google-only ko `set-password` nahi, "forgot password" se | Chori hue access token se permanent password na lage |
| Signup existing email ko touch nahi karta | Kisi ke Google account me password jodna possible na ho |
| Unverified account ka password Google link pe hata dena | Pre-hijacking attack |
| `loginLimiter` + `authLimiter` + `refreshLimiter` | Brute-force, credential stuffing, aur office/NAT ke asli users block na hon |
| Env validation (secret >= 32, alag, `CLIENT_URL`) | Weak/missing config ke saath server chale hi nahi |
| Generic errors client ko, `CastError`/`E11000` mapped | Internals leak na ho, galat input pe 500 nahi |
| Body limit 10kb, `x-powered-by` band | Chhoti hardening |

---

## 17. Config / env variables

Sab `config/env.js` me validate hote hain. List ke liye `.env.example` dekho.

| Variable | Required | Detail |
|---|---|---|
| `MONGO_URI` | haan | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | haan | Google OAuth Web Client ID (audience check ke liye) |
| `JWT_SECRET` | haan (HS256) | Access token secret, >= 32 chars |
| `JWT_REFRESH_SECRET` | haan (HS256) | Refresh secret, >= 32 chars, `JWT_SECRET` se **alag** |
| `CLIENT_URL` | dev me nahi, **production me haan** | Frontend ka URL. CORS origin + email links. Dev default `http://localhost:5173` |
| `PORT` | nahi | Default 8000 |
| `NODE_ENV` | nahi | `production` me cookies `secure`, aur console mail band |
| `JWT_ACCESS_TTL_SECONDS` | nahi | Default 900 (15 min) |
| `JWT_REFRESH_TTL_SECONDS` | nahi | Default 604800 (7 din) |
| `TRUST_PROXY` | nahi | Proxy ke peeche ho to proxies ki sankhya |
| `JWT_ALGORITHM` | nahi | `HS256` (default) ya `RS256` |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KEY_ID` | RS256 me | PEM keys (`\n` escaped) + key id |
| `JWT_PREVIOUS_PUBLIC_KEYS` | nahi | Rotation: `{"kid":"PEM"}` JSON |

Secret generate karne ka tareeka:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Rule:** code me `process.env` seedha mat padho. `import env from './config/env.js'` use karo (validated).

---

## 18. Naya route kaise add karein

**1) Sirf logged-in user ke liye:**

```js
router.get('/credits', requireAuth, getCredits);   // controller me req.auth.userId se user pehchano
```

**2) Sirf ADMIN ke liye:**

```js
router.delete('/users/:id', requireAuth, requireRole('ADMIN'), deleteUser);
```

**3) Error dena ho:**

```js
if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');   // try/catch nahi, handler sambhal lega
```

**4) `app.js` me mount:**

```js
app.use('/api/xyz', xyzRouter);   // notFoundHandler aur errorHandler se PEHLE
```

**5) Naya env variable:** `config/env.js` me validate karke `env` object me add karo, `.env.example` me likho.

**6) Naya email bhejna ho:** `mail.service.js` me function add karo, controller se `sendSafely(...)` ke andar bulao (fail pe flow na tute).

**Checklist:** logic service me, controller patla, input validate (`typeof`), response me `toPublicUser` jaisa filter, errors `ApiError` se, sensitive endpoint pe rate limit, aur **ye doc update karna**.

---

## 19. Frontend contract

1. **Har request me cookies bhejo:** `fetch(url, { credentials: 'include' })` (axios: `withCredentials: true`). Tokens `httpOnly` hain, JS unhe dekh nahi sakti, browser khud bhejta hai. Frontend ka origin `CLIENT_URL` se match hona chahiye (CORS).
2. **Signup (email):** `POST /signup {name,email,password}` -> `201`. **Login nahi hua.** "Check your email" screen dikhao.
3. **Verify page:** `${CLIENT_URL}/verify-email?token=...` -> page URL se token padhe -> `POST /verify-email {token}`. Success pe "ab login karo". `400` pe "link expire ho gaya" + resend ka option.
4. **Login (email):** `POST /login {email,password}`.
   - `401 INVALID_CREDENTIALS`: "email ya password galat".
   - `403 EMAIL_NOT_VERIFIED`: "pehle email verify karo" + **Resend** button (`POST /resend-verification {email}`).
   - `429`: "thodi der baad try karo".
5. **Login (Google):** Google Sign-In se `idToken` -> `POST /google {idToken}`.
6. **Forgot password:** `POST /forgot-password {email}` -> hamesha "agar account hai to link bheja gaya" dikhao. Reset page: `${CLIENT_URL}/reset-password?token=...` -> `POST /reset-password {token, password}` -> "ab login karo".
7. **Change password (settings):** `POST /change-password {currentPassword,newPassword}`. Google-only user ko `400 NO_PASSWORD_SET` aaye to "Forgot password se password set karo" dikhao.
8. **Expire handling:**

```js
let res = await api('/api/auth/me');
if (res.status === 401 && (await res.json()).code === 'TOKEN_EXPIRED') {
    const r = await api('/api/auth/refresh', { method: 'POST' });   // ek hi refresh request (single-flight)
    if (r.ok) res = await api('/api/auth/me');                       // original request retry
    else goToLogin();                                                // refresh fail => dobara login
}
```
9. **Single-flight refresh:** kai requests ek saath expire ho jayein to **ek hi** `/refresh` bhejo, baaki uska result wait karein. Do refresh ek saath bheje to doosre ko reuse maan ke family revoke ho sakti hai.
10. **App load pe** `GET /me`: 200 = logged in, 401 = login screen.
11. **Logout:** `POST /logout` (GET nahi).
12. **Development me email link:** abhi mail nahi jati, link **server ke terminal me** print hota hai (`[DEV MAIL]` block). Wahan se token copy karo.

---

## 20. Scenarios

**A) Naya email user:** signup -> terminal me link -> verify -> login -> `/me`. Verify ke bina login pe `403`.

**B) Normal din (logged in):** login -> access (A1) + refresh (R1). 15 min tak A1 chalta hai. Expire -> `TOKEN_EXPIRED` -> `/refresh` -> A2 + R2 (R1 revoked). Ye 7 din tak chalta rehta hai (har refresh pe naya 7 din ka timer). Dobara login tab jab user 7 din se zyada inactive ho.

**C) Do device:** dono ka alag login = alag `family`. Ek me logout karo to doosra chalta rehta hai. `logout-all` ya password change/reset dono band (password change me current device chhodke).

**D) Refresh token chori:** attacker R1 chura leta hai, asli user R2 tak refresh kar chuka hai. Attacker R1 bhejta hai -> reuse detected -> family revoke (R2 bhi) -> dono ko 401, asli user dobara login karega. Attacker ke paas kuch nahi bachta.

**E) Access token chori:** max 15 min kaam karega. User `logout-all` / password change kare to refresh band, access 15 min me khud mar jayega.

**F) Password bhul gaya:** forgot-password -> terminal me reset link -> reset-password -> saare sessions revoke -> naye password se login.

**G) Pre-hijacking:** attacker victim ka email apne password se signup karta hai. Account unverified rehta hai (victim click nahi karta), login nahi hota. Victim baad me Google se aaye to attacker ka password hat jata hai aur links/sessions saaf.

**H) Google user ko password chahiye:** "forgot password" -> email link -> naya password set. Ab Google aur password dono se login.

**I) User delete / unverified:** agle refresh pe `rotateSession` user nahi paata (ya unverified pata hai) -> family revoke -> 401. (Access token expire tak, max 15 min, chal sakta hai.)

**J) Server restart:** koi farak nahi. Access stateless, refresh/email tokens DB me, state memory me nahi (sirf rate limit counters reset hote hain).

---

## 21. Known limitations

- **Mail service sirf console:** asli email abhi nahi jati. Production deploy se pehle asli provider (Resend/SendGrid/SES/SMTP) lagana zaroori hai (production me console transport band hai). Mail fail hone pe flow chalta rehta hai par user ko email nahi milti.
- **Multi-tab refresh:** do tabs ek saath same refresh token bhejein to ek ko reuse maan ke family revoke ho sakti hai. Fix: frontend me single-flight refresh, ya server pe chhota grace window.
- **Rate limiters in-memory:** single server ke liye theek. Multiple servers me Redis store chahiye. Limiters: `authLimiter` (100/15 min per IP), `loginLimiter` (10 fails/15 min per IP+email), `refreshLimiter` (300/15 min per IP), `emailActionLimiter` (5/ghanta per IP+email), `credentialChangeLimiter` (10 fails/15 min per IP+userId).
- **Role badalne pe delay:** access token me role hai, naya role max 15 min baad lagta hai.
- **Access token revoke nahi:** logout-all / password change ke baad bhi issue ho chuke access tokens 15 min chalte hain. (Turant band chahiye to har request pe DB check lagana padega, jo stateless ka fayda hata deta hai.)
- **Account lockout / CAPTCHA nahi:** distributed brute-force (kai IPs se ek account) nahi rukta.
- **Signup pe email existence pata chalta hai** (`409 EMAIL_TAKEN`). Common trade-off. Poori tarah rokne ke liye "check your email" wala uniform response chahiye (email infra ke saath).
- **Weak/common passwords** (jaise `password123`) block nahi hote. Aage: breached-password check (HIBP k-anonymity) ya `zxcvbn`.
- **Verification link ka ek edge case:** attacker victim ke email se signup kare aur victim confusion me mail ka link click kar de, to attacker ka account verified ho jata hai. Email ka wording ("agar aapne account nahi banaya to ignore karo") isliye important hai.
- **Active sessions list / device management nahi:** `Session` me `userAgent`/`ip` store hota hai, "kaunse devices logged in hain, ek ko nikalo" screen aage ban sakti hai.
- **CSRF:** `sameSite: lax` + CORS allowlist kaafi hai same-site frontend ke liye. Frontend alag site pe gaya to `sameSite: none` + `secure` + CSRF token/header chahiye.
- **Helmet, request validation library (zod), logger (pino)** abhi nahi hain.
- **Real Google end-to-end test** abhi nahi hua (Google verify test me stub kiya gaya).

---

## 22. Quick reference

| Kaam | Function | File |
|---|---|---|
| Env validate | (module load pe) | `config/env.js` |
| Access / refresh token banana | `signAccessToken`, `signRefreshToken` | `config/token.js` |
| Token verify | `verifyAccessToken`, `verifyRefreshToken` | `config/token.js` |
| Google token verify | `verifyGoogleIdToken` | `config/google.js` |
| Google login | `googleAuth` | `controllers/auth.controller.js` |
| Email signup / login | `signup`, `login` | `controllers/auth.controller.js` |
| Email verify / resend | `verifyEmail`, `resendVerification` | `controllers/auth.controller.js` |
| Forgot / reset / change password | `forgotPassword`, `resetPassword`, `changePassword` | `controllers/auth.controller.js` |
| Refresh, logout, me | `refresh`, `logout`, `logoutAll`, `me` | `controllers/auth.controller.js` |
| Naya session + tokens | `issueSession` | `services/session.service.js` |
| Refresh (rotation) | `rotateSession` | `services/session.service.js` |
| Logout (ek / saare) | `revokeSessionByToken`, `revokeAllUserSessions` | `services/session.service.js` |
| Password hash / verify | `hashPassword`, `verifyPassword`, `needsRehash` | `services/password.service.js` |
| Timing-safe dummy verify | `verifyAgainstDummy` | `services/password.service.js` |
| Email token banana / consume | `createEmailToken`, `consumeEmailToken`, `deleteUserEmailTokens` | `services/emailToken.service.js` |
| Email bhejna | `sendVerificationEmail`, `sendPasswordResetEmail`, `setMailTransport` | `services/mail.service.js` |
| Login check / role check | `requireAuth`, `requireRole` | `middlewares/auth.middleware.js` |
| Rate limiters | `authLimiter`, `loginLimiter`, `refreshLimiter`, `emailActionLimiter`, `credentialChangeLimiter` | `middlewares/rateLimit.middleware.js` |
| Cookies set/clear | `setAuthCookies`, `clearAuthCookies` | `utils/cookies.js` |
| Error throw | `ApiError` | `utils/ApiError.js` |
| Error response | `errorHandler`, `notFoundHandler` | `middlewares/error.middleware.js` |
