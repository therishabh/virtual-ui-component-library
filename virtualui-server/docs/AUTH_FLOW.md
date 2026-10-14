# Auth System: Poora Flow (Access + Refresh Token)

Ye document `virtualui-server` ke auth system ko **shuru se end tak** samjhata hai. Isse padhne ke baad kisi bhi file ko khol ke samajh aa jana chahiye ki wo kyu hai aur baaki files se kaise judi hai.

> Padhne ka order: 1 (big picture) -> 2 (files) -> 4 se 8 (flows) -> baaki jab zarurat ho.

---

## Table of contents

1. [Big picture: hum kya bana rahe hain](#1-big-picture)
2. [Files ka map: kaun si file kya karti hai](#2-files-ka-map)
3. [Startup flow: server kaise start hota hai](#3-startup-flow)
4. [Ek request ka safar (middleware order)](#4-ek-request-ka-safar)
5. [Flow 1: Login (Google)](#5-flow-1-login-google)
6. [Flow 2: Protected request (access token)](#6-flow-2-protected-request)
7. [Flow 3: Token expire hua, refresh (rotation)](#7-flow-3-refresh-rotation)
8. [Flow 4: Chori ka detection (reuse detection)](#8-flow-4-reuse-detection)
9. [Flow 5: Logout aur Logout-all](#9-flow-5-logout)
10. [Tokens ke andar kya hai](#10-tokens-ke-andar-kya-hai)
11. [Cookies: kyu aur kaise](#11-cookies)
12. [Database models](#12-database-models)
13. [Error handling aur status codes](#13-error-handling-aur-status-codes)
14. [Security decisions: kya kyu kiya](#14-security-decisions)
15. [Config / env variables](#15-config--env-variables)
16. [Naya route kaise add karein](#16-naya-route-kaise-add-karein)
17. [Frontend ko kya karna hai](#17-frontend-contract)
18. [Real-life scenarios (walkthrough)](#18-scenarios)
19. [Known limitations aur aage ke kaam](#19-known-limitations)

---

## 1. Big picture

**Problem:** User ko ek baar login karna hai, uske baad har request pe server ko pata hona chahiye "ye kaun hai". Password nahi hai, login **Google** se hota hai.

**Solution:** Login ke baad server user ko **do tokens** deta hai:

| | Access token | Refresh token |
|---|---|---|
| Kaam | Har API request me "main ye user hu" proof | Sirf naya access token lene ke liye |
| Life | **15 min** (chhota) | **7 din** (lamba) |
| Kahan jata hai | Har request ke saath | Sirf `/api/auth/*` ke saath |
| Server check kaise karta hai | Sirf signature (DB nahi) | Signature **aur** DB record |
| Revoke ho sakta hai? | Nahi (expire hone tak) | Haan (DB me record hai) |

**Do tokens kyu?** Ek hi lamba token (7 din) rakhein to chori hone pe attacker 7 din use kar sakta hai, aur hum use rok nahi sakte (JWT beech me cancel nahi hota). Do tokens se:
- Access token chhota hai, chori ho to max 15 min ka damage.
- Refresh token lamba hai (user baar-baar login na kare), par wo DB me hai, to hum use **kabhi bhi revoke** kar sakte hain.

**JWT kya hai (1 line):** ek signed string `header.payload.signature`. Server ke paas secret hai, wo signature se verify karta hai ki token usi ne banaya hai aur kisi ne badla nahi. Payload me data hota hai (user id, expiry...), par wo **encrypted nahi**, sirf signed hai. Isliye payload me password/secret kabhi nahi.

**Poori picture:**

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
app.js                         Express app factory (middlewares + routes), listen nahi karta
config/
  env.js                       Saare env variables validate + parse (fail fast)
  db.js                        MongoDB connect / disconnect
  token.js                     JWT banana + verify karna (sirf crypto, DB nahi)
  google.js                    Google ID token verify karna
routes/
  auth.route.js                URL + method ko controller se jodna, middlewares lagana
controllers/
  auth.controller.js           HTTP layer: request padho, service bulao, response do
services/
  session.service.js           Refresh token ka lifecycle: issue, rotate, revoke (DB logic)
middlewares/
  auth.middleware.js           requireAuth (kaun ho?), requireRole (permission hai?)
  rateLimit.middleware.js      Brute-force / abuse rokna
  error.middleware.js          Central error handler + 404
models/
  user.model.js                User schema
  session.model.js             Refresh token records
utils/
  ApiError.js                  Status code wala custom error
  cookies.js                   Cookies set/clear (ek jagah options)
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

### Kaun kisko import karta hai

```
server.js ─► app.js ─► routes/auth.route.js ─► controllers/auth.controller.js ─┬► config/google.js
        │         │                          └► middlewares/{auth,rateLimit}   ├► services/session.service.js ─┬► config/token.js
        │         └► middlewares/error.middleware.js                           │                               └► models/session.model.js
        ├► config/env.js  (sab config files isse padhti hain)                  ├► models/user.model.js
        └► config/db.js                                                        ├► utils/cookies.js
                                                                               └► utils/ApiError.js
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

**Har step kyu:**

1. `dotenv/config` sabse upar: ESM me imports hoist hote hain (file ke code se pehle chalte hain). Isliye `.env` ko side-effect import se load karte hain, taaki koi bhi module `process.env` padhe to values mil jayein. (`config/env.js` me bhi ye import hai, taaki order pe depend na karna pade.)
2. **`config/env.js` fail-fast:** saare variables ek jagah validate hote hain. Missing/weak secret ho to server **start hote hi** band, aur saari galtiyan ek saath dikhti hain:
   ```
   Invalid environment configuration:
    - GOOGLE_CLIENT_ID is required
    - JWT_SECRET must be at least 32 characters
   ```
   Warna galti pehli login request pe runtime me pakdi jati ("secret undefined").
3. **Pehle DB, phir listen:** DB ke bina server traffic le to har request fail hogi.
4. **`createApp()`** (`app.js`) sirf app banata hai, `listen` nahi. Isse tests me bina port khole app chal sakta hai.
5. **Graceful shutdown:** Ctrl+C / Docker stop pe naye connections band, chal rahi requests poori, phir DB close, phir exit. Seedha kill karne se in-flight requests kat jati hain.

---

## 4. Ek request ka safar

`app.js` me middlewares ka **order** hi pipeline hai. Har request upar se neeche jaati hai:

```js
app.disable('x-powered-by');                 // framework ka naam chhupao
app.set('trust proxy', env.TRUST_PROXY);     // (optional) proxy ke peeche asli IP ke liye
app.use(express.json({ limit: '10kb' }));    // JSON body parse (bade body reject)
app.use(cookieParser());                     // req.cookies bharo
app.get('/', healthCheck);
app.use('/api/auth', authRouter);            // routes
app.use(notFoundHandler);                    // koi route match nahi -> 404 JSON
app.use(errorHandler);                       // koi bhi error -> ek jaisa JSON (HAMESHA last)
```

**Kyu order matter karta hai:**
- `express.json()` aur `cookieParser()` routes se **pehle**, warna `req.body` / `req.cookies` khali milenge.
- `errorHandler` **last** me, taaki upar ke saare middlewares/routes ke errors yahan aayein.
- Express 5 me async handler ka `throw` ya rejected promise **apne aap** `errorHandler` tak jata hai, isliye controllers me `try/catch` nahi likhte.

Fir `/api/auth/...` pe route ke andar:

```
POST /api/auth/google  ->  authLimiter  ->  googleAuth (controller)
GET  /api/auth/me      ->  requireAuth  ->  me (controller)
```

---

## 5. Flow 1: Login (Google)

**Endpoint:** `POST /api/auth/google`   **Body:** `{ "idToken": "<Google ka token>" }`

### Sequence

```
Browser                 Express                   Google              MongoDB
  │  Google Sign-In       │                         │                    │
  │ ───────────────────────────────────────────────►│ (user Google me login karta hai)
  │ ◄─────────────────────────────────────────────── idToken (Google ne sign kiya)
  │                       │                         │                    │
  │ POST /google {idToken}│                         │                    │
  │ ─────────────────────►│ 1. authLimiter (rate limit check)            │
  │                       │ 2. validate: idToken string hai?             │
  │                       │ 3. verifyIdToken ──────►│ signature, expiry, │
  │                       │ ◄────────────────────── │ audience check     │
  │                       │ 4. email_verified true?                      │
  │                       │ 5. user find / create ───────────────────────► users
  │                       │ 6. issueSession: 2 tokens banao              │
  │                       │    refresh ka hash save ─────────────────────► sessions
  │ ◄─────────────────────│ 7. Set-Cookie x2 + JSON {user}               │
```

### Step by step (code ke saath)

**1) Rate limit** (`middlewares/rateLimit.middleware.js`): ek IP se 15 min me max 30 requests, warna `429`. Brute-force aur abuse rokta hai.

**2) Validation** (`controllers/auth.controller.js`):

```js
const { idToken } = req.body ?? {};
if (typeof idToken !== 'string' || !idToken.trim()) {
    throw new ApiError(400, 'idToken is required', 'VALIDATION_ERROR');
}
```
`typeof` check zaroori hai: koi object bhej de (`{"$ne": null}`) to wo DB query me ghus ke NoSQL injection ban sakta hai.

**3) Google verify** (`config/google.js`):

```js
const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
const payload = ticket.getPayload();   // { sub, email, email_verified, name }
```
Library Google ki public keys se **signature, expiry, issuer** check karti hai. `audience` check hamara kaam hai: iske bina kisi **doosri app** ke liye bana Google token bhi accept ho jata. Fail hone pe client ko sirf generic `401 Invalid Google token` (detail se attacker ko hint milta hai).

> **Sabse important rule:** email/name **kabhi** `req.body` se mat lo. Browser kuch bhi bhej sakta hai. Hamesha Google ke verified token ke payload se lo.

**4) Email verified?** `email_verified` false ho to reject. Warna koi kisi aur ka email claim karke us email ke account me ghus sakta hai.

**5) User find / create:**

```js
const email = profile.email.trim().toLowerCase();   // normalize: duplicate users na bane
let user = await User.findOne({ email });
if (!user) {
    try {
        user = await User.create({ name, email, googleId: profile.googleId });
    } catch (error) {
        if (error.code !== 11000) throw error;       // sirf duplicate-key ko handle
        user = await User.findOne({ email });        // race condition: doosri request ne bana diya
    }
}
```
- Race condition: do requests ek saath aayein to dono "user nahi mila" dekhte hain, ek create karta hai, doosra unique index pe `E11000` se fail. Us case me error nahi, bana hua user fetch karte hain.
- **Account linking:** pehle se email se bana user (googleId nahi) ho to Google ki `sub` (stable id) attach karte hain. Alag googleId mila to reject (`GOOGLE_ACCOUNT_MISMATCH`).

**6) Session issue** (`services/session.service.js` -> `issueSession`):

```js
const accessToken = signAccessToken({ userId: user._id, role: user.role });
const { token: refreshToken, jti, expiresAt } = signRefreshToken({ userId: user._id });
await Session.create({ user, jti, family, tokenHash: sha256(refreshToken), expiresAt, userAgent, ip });
```
- Refresh token ka **hash** DB me jata hai, raw token nahi (password hash jaisa logic: DB leak ho to bhi attacker ke kaam ka kuch nahi).
- `family` = is login ki pehchaan. Aage rotation me har naya token isi family me aata hai (reuse detection me kaam aata hai, flow 4).

**7) Response:** `utils/cookies.js` ke `setAuthCookies` se dono tokens `httpOnly` cookies me, aur body me `toPublicUser(user)`: sirf `id, name, email, role, aiCredits` (poora DB document kabhi nahi, taaki `googleId` jaisi cheezein leak na hon). Naya user = `201`, existing = `200`.

---

## 6. Flow 2: Protected request

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
    next();                                            // controller ko jane do
} catch (error) {
    if (error.name === 'TokenExpiredError') throw new ApiError(401, 'Access token expired', 'TOKEN_EXPIRED');
    throw new ApiError(401, 'Invalid access token', 'INVALID_TOKEN');
}
```

- **DB hit nahi:** access token **stateless** hai, signature se hi proof ho jata hai. Isliye har request pe fast.
- `req.auth` baad ke handlers ke liye hai (`req.auth.userId`, `req.auth.role`).
- `TOKEN_EXPIRED` alag code hai: frontend ise dekh ke chupchap `/refresh` call karta hai (message text pe depend nahi karta).
- `/me` controller DB se **fresh** user padhta hai (token ka data 15 min tak purana ho sakta hai, jaise `aiCredits`).

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
`requireRole` hamesha `requireAuth` ke **baad** lagta hai (kyunki `req.auth` wahi set karta hai). Ye factory function hai, taaki alag routes pe alag roles de sako.

---

## 7. Flow 3: Refresh (rotation)

15 min baad access token expire ho jata hai:

```
GET /me ──► 401 { code: "TOKEN_EXPIRED" }
POST /refresh (refreshToken cookie) ──► 200 + naye dono tokens
GET /me (retry) ──► 200
```

`rotateSession` (`services/session.service.js`) ke steps:

```
1. refresh JWT verify         (signature, expiry, iss, aud=refresh)         ──fail──► 401
2. DB me jti se Session dhundo, hash match karo (timing-safe compare)      ──fail──► 401
3. session.revokedAt hai? ──► REUSE! poori family revoke                    ─────────► 401   (flow 4)
4. Atomically purana revoke karo (updateOne revokedAt:null -> now)
   modifiedCount != 1 ? ──► koi parallel request jeet gayi, REUSE maano    ─────────► 401
5. User abhi bhi exist karta hai? nahi ──► family revoke                    ─────────► 401
6. issueSession(user, meta, SAME family) -> naya access + naya refresh
7. purane session pe replacedBy = naya jti (audit trail)
```

**Rotation kyu:** refresh token ek baar hi use ho sakta hai. Har refresh pe naya milta hai, purana turant revoke. Isse chori hua token zyada der kaam ka nahi rehta, aur reuse pakda ja sakta hai (flow 4).

**Atomic claim (step 4) kyu:**

```js
const claimed = await Session.updateOne(
    { _id: session._id, revokedAt: null },       // filter me revokedAt:null
    { $set: { revokedAt: new Date() } },
);
if (claimed.modifiedCount !== 1) { /* doosri request pehle pahunchi */ }
```
Do requests same token se ek saath aayein to DB sirf ek ko update karne deta hai (filter me `revokedAt: null` hai). Pehle `findOne` phir `update` karte to dono pass ho jati.

Controller (`refresh`) agar 401 hota hai to browser ki ab-bekaar cookies bhi clear kar deta hai.

---

## 8. Flow 4: Reuse detection

**Idea:** rotation me har refresh token **ek hi baar** valid hai. Agar koi **purana (already use ho chuka)** token bheje, to iska matlab do log (asli user + attacker) ek hi token ki copies use kar rahe hain, yaani token **chori** hua.

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

Code:

```js
if (session.revokedAt) {
    await revokeFamily(session.family);   // is login ki poori chain revoke
    throw unauthorized();
}
```

- **Family** = ek login se bani poori rotation chain. Poori family revoke karne se attacker ke paas jo bhi latest token hai wo bhi mar jata hai.
- Trade-off: asli user ko dobara login karna padta hai, par account safe rehta hai. Ye sahi trade hai.

---

## 9. Flow 5: Logout

### `POST /api/auth/logout` (ek device)

```js
const refreshToken = req.cookies?.refreshToken;
if (refreshToken) await revokeSessionByToken(refreshToken);   // DB me family revoke
clearAuthCookies(res);                                         // browser se cookies hatao
return res.status(200).json(...);                              // HAMESHA 200
```

- **Asli logout:** pehle sirf cookie hat-ti thi, token 7 din valid rehta. Ab DB me revoke hota hai, to token kabhi kaam nahi karega.
- `requireAuth` **nahi** lagaya: access token expire ho chuka ho tab bhi user logout kar sake.
- **Idempotent:** pehle se logout ho (ya cookie hi na ho) to bhi `200`. Logout kabhi fail nahi hona chahiye.
- **POST** hai, GET nahi: state change GET se nahi hona chahiye (`<img src=".../logout">` se koi chupke se logout/CSRF kara sakta hai, browser prefetch bhi GET call kar deta hai).

### `POST /api/auth/logout-all` (saare devices)

```js
router.post('/logout-all', requireAuth, logoutAll);
await Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
```
Account compromise ka shak ho to: user ke **saare** active sessions revoke. `requireAuth` chahiye (kaun user hai ye pata hona chahiye).

> **Note:** jo access tokens already issue ho chuke hain wo expire hone tak (max 15 min) chalenge, kyunki wo stateless hain. Refresh tokens turant mar jate hain, isliye 15 min ke baad poora access band.

---

## 10. Tokens ke andar kya hai

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
| `sub` | Subject: token kis user ka hai | Standard claim (pehle custom `userId` tha) |
| `iss` | Issuer: kisne banaya | Verify pe check: dusre server ka token reject |
| `aud` | Audience: kis kaam ke liye | **Access aur refresh alag**, taaki refresh token ko access ki tarah use na kiya ja sake (token confusion attack) |
| `jti` | JWT id: unique | Refresh token ko DB me track/revoke karne ke liye |
| `iat` / `exp` | Issued at / Expiry | Library khud lagati hai |
| `role` | User ka role | `requireRole` bina DB ke check kare (access token me hi) |

**Role token me kyu:** `requireRole` ko DB hit na karna pade. Trade-off: role badalne pe naya role max 15 min baad lagega.

**Verify me teen cheezein pin hain:**

```js
jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'virtualui-server', audience: 'virtualui:access' });
```
`algorithms` pin na ho to attacker header me `alg: none` ya doosra algorithm daal ke bypass try karta hai (algorithm confusion).

**Signing algorithm:**
- **HS256 (default):** ek shared secret sign aur verify dono. Access (`JWT_SECRET`) aur refresh (`JWT_REFRESH_SECRET`) ke secrets **alag** (ek leak ho to doosra safe).
- **RS256 (optional, `JWT_ALGORITHM=RS256`):** private key se sign, public key se verify. Tab kaam aata hai jab alag services token verify karein (unhe secret nahi dena padta). Header me `kid` (key id) hota hai, **key rotation** ke liye:

```
nayi key:  JWT_KEY_ID=k2, JWT_PRIVATE_KEY/JWT_PUBLIC_KEY = nayi
purani:    JWT_PREVIOUS_PUBLIC_KEYS={"k1":"<purani public key>"}
```
Naye tokens `k2` se sign hote hain, purane (`k1`) tokens expire hone tak verify hote rahte hain. Sab purane expire hone ke baad `k1` hata do.

---

## 11. Cookies

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
- **Refresh ka path chhota:** wo baaki API requests ke saath nahi jata, sirf `/api/auth/*` pe. Exposure kam = chori ka chance kam. (Isi liye `logout` ko bhi refresh cookie mil jati hai, kyunki wo bhi `/api/auth` ke andar hai.)
- **`clearCookie` ko set ke same options chahiye** (path, sameSite, secure, httpOnly). Alag options diye to browser cookie delete nahi karta. Isliye options ek constant me hain.

---

## 12. Database models

### `User` (`models/user.model.js`)

| Field | Detail |
|---|---|
| `name` | required, trim, max 100 |
| `email` | required, trim, **lowercase**, format check, **unique index** |
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
| `revokedAt` | `null` = active; date = revoke (rotate/logout/reuse) |
| `replacedBy` | Rotation me iski jagah kaunsa naya `jti` bana (audit trail) |
| `userAgent`, `ip` | Kis device/IP se (aage "active devices" screen ke kaam aayega) |

Indexes: `jti` unique, `family`, `{user, revokedAt}` (logout-all fast), `expiresAt` TTL.

---

## 13. Error handling aur status codes

**Pattern:** jahan error ho wahan `throw new ApiError(status, message, code)`. Central handler (`middlewares/error.middleware.js`) ek jaisa response banata hai:

```json
{ "status": false, "message": "Access token expired", "code": "TOKEN_EXPIRED" }
```

- `message` insaan ke liye, `code` **frontend ke code** ke liye (message badal sakta hai, code fix rehta hai).
- Expected error (`ApiError`): jo message diya wahi jata hai.
- **Unexpected error:** poora error sirf server log me; client ko generic `500 Internal server error`. Stack/internals kabhi leak nahi karte.

| Status | Kab | `code` examples |
|---|---|---|
| 400 | Galat input | `VALIDATION_ERROR`, `BAD_JSON` |
| 401 | Authenticated nahi (token missing/invalid/expired) | `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `NO_REFRESH_TOKEN`, `INVALID_GOOGLE_TOKEN`, `EMAIL_NOT_VERIFIED` |
| 403 | Authenticated hai, permission nahi | `FORBIDDEN` |
| 404 | Route nahi mila | `NOT_FOUND` |
| 413 | Body 10kb se badi | `BODY_TOO_LARGE` |
| 429 | Rate limit | `RATE_LIMITED` |
| 500 | Unexpected | `INTERNAL_ERROR` |

**401 vs 403:** 401 = "tum kaun ho pata nahi / token galat". 403 = "tum kaun ho pata hai, par ye allowed nahi".

---

## 14. Security decisions

| Decision | Kyu |
|---|---|
| Google ID token server pe verify | Client ke data pe trust nahi, warna koi bhi kisi ka account use kare |
| `audience` check | Dusri app ka Google token accept na ho |
| `typeof` input check | NoSQL injection roke |
| Access 15 min, refresh 7 din | Chori ka damage limited, par user baar-baar login na kare |
| Alag secrets (HS256) | Ek leak ho to doosra safe |
| `aud` alag | Refresh token ko access token bana ke use nahi kar sakte |
| Algorithm / issuer / audience pin | Algorithm confusion aur dusre issuer ke tokens se bachav |
| Refresh token DB me, hash karke | Revoke possible; DB leak se token use nahi |
| Timing-safe compare | Hash compare me timing attack ka risk khatam |
| Rotation + reuse detection | Chori hua refresh token pakda jata hai |
| Atomic `updateOne` claim | Parallel refresh me race condition nahi |
| `httpOnly` cookies | XSS me token chori nahi |
| `sameSite: lax`, POST logout | CSRF se bachav |
| Refresh cookie ka chhota path | Exposure kam |
| Rate limiting | Brute-force / abuse |
| Env validation | Weak/missing secret ke saath server chale hi nahi |
| Generic errors client ko | Internals/hints leak na ho |
| `toPublicUser` | Poora DB document kabhi response me nahi |
| Body limit 10kb, `x-powered-by` band | Chhoti hardening |

---

## 15. Config / env variables

Sab `config/env.js` me validate hote hain. List ke liye `.env.example` dekho.

| Variable | Required | Detail |
|---|---|---|
| `MONGO_URI` | haan | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | haan | Google OAuth Web Client ID (audience check ke liye) |
| `JWT_SECRET` | haan (HS256) | Access token secret, >= 32 chars |
| `JWT_REFRESH_SECRET` | haan (HS256) | Refresh secret, >= 32 chars, `JWT_SECRET` se **alag** |
| `PORT` | nahi | Default 8000 |
| `NODE_ENV` | nahi | `production` me cookies `secure` hoti hain |
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

**Rule:** code me `process.env` seedha mat padho. `import env from './config/env.js'` use karo (validated aur typed).

---

## 16. Naya route kaise add karein

**1) Sirf logged-in user ke liye:**

```js
// routes/xyz.route.js
router.get('/credits', requireAuth, getCredits);
// controller me: req.auth.userId se user pehchano
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

**Checklist:** logic service me, controller patla, input validate (`typeof`), response me `toPublicUser` jaisa filter, errors `ApiError` se.

---

## 17. Frontend contract

1. **Login:** Google Sign-In se `idToken` lo -> `POST /api/auth/google` body `{ idToken }`.
2. **Har request me cookies bhejo:** `fetch(url, { credentials: 'include' })` (axios: `withCredentials: true`). Tokens `httpOnly` hain, JS unhe dekh nahi sakti, browser khud bhejta hai.
3. **Expire handling:**

```js
let res = await api('/api/auth/me');
if (res.status === 401 && (await res.json()).code === 'TOKEN_EXPIRED') {
    const r = await api('/api/auth/refresh', { method: 'POST' });   // ek hi refresh request (single-flight)
    if (r.ok) res = await api('/api/auth/me');                       // original request retry
    else goToLogin();                                                // refresh fail => dobara login
}
```
4. **Single-flight refresh:** kai requests ek saath expire ho jayein to **ek hi** `/refresh` bhejo, baaki uska result wait karein. Do refresh ek saath bheje to doosre ko reuse maan ke family revoke ho sakti hai.
5. **App load pe** `GET /api/auth/me`: 200 = logged in, 401 = login screen.
6. **Logout:** `POST /api/auth/logout` (GET nahi).
7. **CORS:** frontend alag origin pe ho to server me CORS `credentials: true` aur specific origin chahiye, aur cookies me `sameSite: 'none'` + `secure` (abhi CORS configure nahi hai).

---

## 18. Scenarios

**A) Normal din:**
1. Subah login -> access (A1) + refresh (R1) cookies.
2. 15 min tak requests A1 se chalti hain.
3. A1 expire -> `TOKEN_EXPIRED` -> `/refresh` -> A2 + R2 (R1 revoked).
4. Ye 7 din tak chalta rehta hai (har refresh pe R naya, 7 din ka timer naye token se shuru). Sirf tab dobara login jab user 7 din se zyada inactive ho.

**B) Do device (phone + laptop):** Dono ka alag login = alag `family`, alag Session records. Ek me logout karo to doosra chalta rehta hai. `logout-all` dono band.

**C) Refresh token chori:**
1. Attacker R1 chura leta hai, asli user R2 tak refresh kar chuka hai.
2. Attacker R1 bhejta hai -> DB me R1 revoked -> **reuse detected** -> family revoke (R2 bhi).
3. Attacker ko 401. Asli user ko bhi 401, dobara Google se login. Attacker ke paas ab kuch nahi.
4. Agar attacker pehle pahunch jaye (R1 use kar le), to asli user ka R1 reuse maana jayega, phir bhi family revoke hoti hai. Dono me se koi bhi chale, chori pakdi jati hai.

**D) Access token chori:** max 15 min kaam karega. Isse zyada ka damage nahi. User `logout-all` kare to refresh band, access token 15 min me khud mar jayega.

**E) User ban / delete:** user delete ho to agle refresh pe `rotateSession` user nahi paata -> family revoke -> 401. (Access token expire hone tak, max 15 min, chal sakta hai.)

**F) Server restart:** koi farak nahi. Access token stateless hai, refresh DB me hai, session state memory me nahi.

---

## 19. Known limitations

- **Multi-tab refresh:** do tabs ek saath same refresh token bhejein to ek ko reuse maan ke family revoke ho sakti hai. Fix: frontend me single-flight refresh (upar), ya server pe chhota grace window.
- **Rate limiter in-memory:** single server ke liye theek. Multiple servers me Redis store chahiye (warna har server ki alag count). Ek hi limiter `/google` aur `/refresh` dono ke liye hai, to dono ka count **shared** hai.
- **Role badalne pe delay:** access token me role hai, to naya role max 15 min baad lagta hai.
- **Access token revoke nahi:** logout-all ke baad bhi issue ho chuke access tokens 15 min chalte hain. (Turant band chahiye to har request pe DB check lagana padega, jo stateless ka fayda hata deta hai.)
- **CSRF:** abhi `sameSite: lax` kaafi hai (same site). Frontend alag domain pe gaya to `sameSite: none` + CSRF token/header chahiye.
- **CORS, helmet, request validation library (zod), logger (pino)** abhi nahi hain.
- **Real Google end-to-end test** abhi nahi hua (Google verify test me stub kiya gaya).

## Quick reference: kaun sa function kahan

| Kaam | Function | File |
|---|---|---|
| Env validate | (module load pe) | `config/env.js` |
| Access / refresh token banana | `signAccessToken`, `signRefreshToken` | `config/token.js` |
| Token verify | `verifyAccessToken`, `verifyRefreshToken` | `config/token.js` |
| Google token verify | `verifyGoogleIdToken` | `config/google.js` |
| Login karna | `googleAuth` | `controllers/auth.controller.js` |
| Naya session + tokens | `issueSession` | `services/session.service.js` |
| Refresh (rotation) | `rotateSession` | `services/session.service.js` |
| Logout (ek device) | `revokeSessionByToken` | `services/session.service.js` |
| Logout (saare) | `revokeAllUserSessions` | `services/session.service.js` |
| Login check | `requireAuth` | `middlewares/auth.middleware.js` |
| Role check | `requireRole` | `middlewares/auth.middleware.js` |
| Cookies set/clear | `setAuthCookies`, `clearAuthCookies` | `utils/cookies.js` |
| Error throw | `ApiError` | `utils/ApiError.js` |
| Error response | `errorHandler` | `middlewares/error.middleware.js` |
