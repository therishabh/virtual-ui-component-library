# Virtual UI Library Project

React component library (`virtualui-lib`) + Express backend (`virtualui-server`). Ye README learning diary hai: **kab kya kiya, kyu kiya, aur kya seekha**, step-by-step (purana upar, naya neeche).

## Structure

```
virtualui-lib/            # npm package
├── src/
│   ├── components/{Button,Card}/*.jsx
│   └── index.js          # public API (named exports)
├── tsup.config.js
└── package.json
virtualui-server/         # Express 5 backend (ESM)
├── app.js / server.js    # app factory / entry point (listen + graceful shutdown)
├── config/               # env.js (validation), db.js, token.js (JWT), google.js
├── controllers/          # HTTP layer (patla)
├── services/             # session, password, emailToken, mail
├── middlewares/          # auth, rateLimit, error
├── models/               # user, session, emailToken
├── routes/ utils/        # route wiring, ApiError, cookies
└── .env.example          # saare env variables ki list
virtualui-client/         # Vite + React 19 scaffold (ESM, ESLint flat config)
```

---

## Steps

### Step 1: Button aur Card components
`virtualui-lib/src/components/Button/Button.jsx` aur `Card/Card.jsx` banaye (files pehle empty thi).

```jsx
const Button = ({ children = "Button", variant = "primary", size = "md", style = {}, ...rest }) => (
  <button style={{ ...variants[variant], ...sizes[size], ...style }} {...rest}>
    {children}
  </button>
);
```

- Defaults destructuring me set kiye, `defaultProps` nahi. React 19 me function components ke liye `defaultProps` hata diya gaya hai.
- `...rest` native element pe spread hota hai, taaki `aria-*`, `data-*`, `className`, handlers bina declare kiye kaam karein.
- `style` last me spread hota hai, taaki consumer variant/size ke styles override kar sake (later key wins).
- Variants/sizes object map me rakhe, if/else chain nahi. Naya variant = ek key:

```js
const variants = {
  primary: { background: "#2563eb", color: "#fff" },
  outline: { background: "transparent", color: "#2563eb" },
};
```

- Limitation: inline styles me `:hover`, `:focus`, media queries nahi chalte. Real theming ke liye CSS variables ya CSS-in-JS lagega.

### Step 2: Library ko build karna (tsup)
`src/index.js` se `Button`, `Card` export kiye, aur `tsup.config.js` banayi.

```js
export default defineConfig({
  entry: ["src/index.js"],
  format: ["esm", "cjs"],
  external: ["react"],
  dts: false,
  clean: true,
});
```

- `format: ["esm", "cjs"]`: ESM (`index.mjs`) modern bundlers ke liye, tree-shaking milti hai. CJS (`index.js`) purane tooling/`require` ke liye.
- `external: ["react"]`: react bundle me chala gaya to consumer app me **do React copies** ho jayengi aur "Invalid hook call" aayega. Isliye `peerDependencies` + `external`, dono zaroori.
- `.jsx` ko esbuild (tsup ke andar) khud handle karta hai.
- Classic JSX transform me `React` import chahiye (`React.createElement`). IDE ka "React unused" warning false alarm hai, import hatana nahi hai.
- `dts: false`: types nahi ban rahe, TS users ko autocomplete nahi milega. Fix: `dts: true`.

### Step 3: package.json ke fields
```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "files": ["dist"],
  "peerDependencies": { "react": "^19.3.0" }
}
```

- `main` → CJS, `module` → ESM. Better option `exports` map hai (formats explicit, deep imports block). Abhi add nahi kiya:

```json
"exports": { ".": { "import": "./dist/index.mjs", "require": "./dist/index.js" } }
```

- `files: ["dist"]`: tarball me sirf build output jata hai. README aur package.json hamesha include hote hain.
- `react: ^19.3.0` bahut tight hai, React 18 users ko warning aayegi. Wide range: `"^18 || ^19"`.

### Step 4: npm publish try kiya (fail hua)
Pehle `npm pack --dry-run` se tarball check kiya (sirf `dist/` + `package.json` + README ja rahe the). Package ka naam `dyninno-virtualui-lib` kiya, phir publish:

```
npm error You cannot publish over the previously published versions: 1.0.0.
```

- Ek baar publish hua version dobara publish nahi hota, na overwrite hota hai.
- Fix: version badhao, phir publish.

```bash
npm version patch   # 1.0.0 -> 1.0.1
npm publish
```

### Step 5: README files
- `virtualui-lib/README.md`: npm page ke liye (usage + props tables). Ye isliye package folder me hai kyunki npm README isi folder se uthata hai.
- Root `README.md`: ye diary.

### Step 6: Repo setup
Root pe `.gitignore` (`node_modules/`, `dist/`, `*.tgz`, `.env*`) aur GitHub repo: https://github.com/therishabh/virtual-ui-component-library (`main`).

- `dist/` ignore hai kyunki build output hai; npm publish `files` field se dist leta hai, git se nahi.
- Khali folders (`virtualui-client`) git track nahi karta, files aane pe hi dikhenge.

### Step 7: CLAUDE.md
README ke rules (diary style, chronological steps, no basic steps, "kyu" likhna, code snippets, commit se pehle update) aur working rules (publish/push sirf bolne pe) `CLAUDE.md` me likhe, taaki Claude hamesha follow kare.

### Step 8: virtualui-server (Express 5)
```js
app.get('/', (req, res) => {
  res.status(200).json({ message: "success", status: true });
});
app.listen(8000);
```

- ESM backend (`"type": "module"`), isliye `import express from 'express'`, `require` nahi.
- Express 5: async handlers me rejected promise/throw automatically error middleware tak jata hai, `try/catch` wrapper nahi chahiye.
- Dependencies: `express`, `mongoose`, `jsonwebtoken`, `cookie-parser`, `cors`, `dotenv`. Abhi sirf express use ho raha hai, baaki auth/DB ke liye.
- `npm run dev` → `nodemon index.js` (auto-restart).
- Dhyan: `nodemon` `dependencies` me hai, devDependency hona chahiye. `PORT` hardcoded `8000` hai.

### Step 9: MongoDB connection (`config/db.js`) aur startup flow
Pehle version me 3 problems thi, review ke baad fix kiye:

- **`module.exports` ESM me:** project `"type": "module"` hai, isliye `ReferenceError: module is not defined` aata. Fix: `export default connectToDb`.
- **`MONGO_URI` import time pe read ho raha tha:** ESM me imports hoist hote hain, to `db.js` pehle evaluate hota aur `index.js` ka `dotenv.config()` baad me, matlab URI `undefined`. Fix: URI function ke andar padho, aur `index.js` me sabse upar `import 'dotenv/config'`.
- **`connectToDb` kahin call nahi ho raha tha:** server bina DB ke start ho jata.

```js
// index.js
import 'dotenv/config';
try {
  await connectToDb();          // pehle DB, phir listen
  app.listen(PORT, ...);
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
```

- **Modern dotenv:** `import 'dotenv/config'` side-effect import hai, baaki imports ki tarah order me chalta hai. Purana `import dotenv from 'dotenv'; dotenv.config();` imports ke **baad** chalta hai (imports hoist hote hain), to koi module top-level pe `process.env` padhe to `undefined` milta. `'dotenv/config'` sabse upar rakho, to `.env` har module se pehle load hota hai.
- `db.js` sirf error **throw** karta hai, `process.exit` nahi. App start/stop ka decision `index.js` leta hai, isse `db.js` testable rehta hai.
- `serverSelectionTimeoutMS: 5000`: wrong URI pe default 30s latakne ki jagah 5s me fail.
- `error` / `disconnected` events pe listeners: DB drop hone pe monitoring me dikhta hai.
- `SIGINT`/`SIGTERM` pe `mongoose.connection.close()`: graceful shutdown.
- Missing `MONGO_URI` pe clear error. `PORT` fallback `8000` kiya (pehle `9000` tha).

### Step 10: User model (`models/user.model.js`)
Fields: `name`, `email`, `role` (ADMIN/USER), `aiCredits` (default 150), plus `timestamps`.

**Bug jo mila:** `lowerCase: true` likha tha. Mongoose ka option `lowercase` hai, galat spelling **silently ignore** hoti hai (error nahi aata). Result: `TEST@Mail.com` aur `test@mail.com` alag users ban jate, aur unique index bhi bypass hota.

```js
email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email format'] }
```

Improvements:
- `ROLES` ko `Object.freeze` constant banaya aur export kiya, taaki middleware/controllers me magic strings (`"ADMIN"`) na likhne padein.
- `aiCredits` pe `min: 0`: credits negative na ho sakein.
- Email pe basic format `match` aur `name` pe `maxlength`; validation messages custom.
- `versionKey: false` rakha: `__v` field nahi chahiye.
- Unique index `schema.index()` se (email lookup fast + duplicate block). Isse race condition me bhi duplicate nahi banta, sirf app-level check pe depend nahi.
- Verify kiya: trim/lowercase, invalid email aur negative credits sab sahi kaam kar rahe hain.

### Step 11: JWT helper (`config/token.js`)
Pehle version me problems:

- **Error swallow ho raha tha:** `catch` me sirf `console.error` hota tha, function `undefined` return karta. Caller `res.cookie('token', undefined)` kar deta aur login "successful" dikhta, par token hota hi nahi. Fix: error **throw** karo, caller/error middleware handle kare.
- **Unnecessary `async/await`:** `jwt.sign` bina callback ke synchronous hai, `await` ka koi matlab nahi. Ab `generateToken` sync hai.
- **`JWT_SECRET` missing ho to** `jsonwebtoken` ka confusing error aata. Ab clear `JWT_SECRET is not defined`.
- **`verifyToken` nahi tha:** add kiya, aur `algorithms: ['HS256']` pin kiya. Verify me algorithm pin na ho to algorithm-confusion type attacks ka risk rehta hai.

```js
export const generateToken = (userId) =>
  jwt.sign({ userId }, getSecret(), { algorithm: 'HS256', expiresIn: '7d' });

export const verifyToken = (token) =>
  jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
```

- Verify kiya: token ban/verify ho raha hai (7d = 604800s), tampered token pe `JsonWebTokenError`, missing secret pe clear error.

### Step 12: Auth controller (`controllers/auth.controller.js`)
`googleAuth` (login/signup) aur `logout`. Review me ye problems mili:

- **Security (abhi bhi open):** email/name seedha `req.body` se aa raha hai, koi bhi kisi ka bhi email bhej ke uske account me login ho sakta hai. Fix (pending): client se Google **ID token** lo, server pe `google-auth-library` ke `verifyIdToken` se verify karo, aur email/name token ke payload se lo. Client ke data pe trust nahi.
- **NoSQL injection:** `findOne({ email })` me email object ho (`{"$ne": null}`) to koi bhi user mil jata hai. Fix: `typeof email === "string"` check, 400 return.
- **`generateToken` async tha, controller me `await` nahi tha:** cookie me token ki jagah Promise chala jata. Fix: `generateToken` sync kiya (`jwt.sign` sync hi hai).
- **Race condition:** `findOne` phir `create` me do parallel requests aayein to dono "user nahi hai" dekhte hain, ek create hota hai aur doosra unique index pe `E11000` se fail. Fix: `findOneAndUpdate` upsert abhi use nahi kar rahe (user ka decision), isliye `create` ke error me `code === 11000` pakad ke user ko wapas `findOne` se fetch karte hain.

```js
let user = await User.findOne({ email: normalizedEmail });
if (!user) {
  try {
    user = await User.create({ name, email: normalizedEmail });
  } catch (error) {
    if (error.code !== 11000) throw error;      // sirf duplicate-key ko handle karo
    user = await User.findOne({ email: normalizedEmail });
  }
}
```

Aur patterns jo follow karne hain:
- **try/catch hatao:** Express 5 async errors khud error middleware tak bhejta hai. Pehle catch me `error` object seedha response me ja raha tha (internals leak).
- **Cookie options ek constant me:** `secure` ab `NODE_ENV === "production"` se (pehle hardcoded `false`). `clearCookie` ko set ke same options chahiye warna cookie delete nahi hoti. `sameSite: "lax"` default; alag domain ke frontend pe `"none"` + `secure`.
- **Sahi status codes:** naya user `201`, existing `200`, bad input `400`. Message bhi sahi (pehle login pe bhi "created" aata tha).
- Email ko `trim().toLowerCase()` karke hi lookup karo.
- Verify kiya: validation (400) aur logout cookie options. **DB wala upsert path test nahi hua** (Atlas connection abhi nahi ban raha).

### Step 13: `app.js` aur `server.js` alag kiye (`index.js` hata diya)
Pehle `index.js` me app banana, middlewares, DB connect aur listen sab ek jagah tha. Ab:

- **`app.js`** = Express app **factory** (`createApp()`): middlewares + routes, `listen()` nahi, DB nahi.
- **`server.js`** = entry point: DB connect -> `listen` -> graceful shutdown.

```js
// app.js
export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
};
```

Kyu alag kiya:
- **Testing:** `supertest(createApp())` se bina port khole, bina DB ke routes test ho sakte hain. Factory se har test ko fresh app milta hai.
- **Separation of concerns:** HTTP config alag, process lifecycle (signals, exit codes) alag.

Graceful shutdown (`server.js`) ka order important hai:

```js
server.close(cb);            // 1. naye connections band, chal rahi requests poori hone do
server.closeIdleConnections(); // keep-alive idle sockets turant band, warna close() atka rehta hai
await disconnectDb();        // 2. phir DB close (pehle DB band kiya to in-flight requests fail hongi)
process.exit(0);
```

- `SIGINT` (Ctrl+C) aur `SIGTERM` (Docker/k8s/pm2) dono handle. Double signal ignore (`isShuttingDown` flag).
- 10s ka force-exit timer (`unref()` ke saath, taaki timer khud process ko zinda na rakhe).
- `unhandledRejection` / `uncaughtException`: log karo, cleanly band karo, **exit code 1** (process ka state in cases me bharosemand nahi).
- `db.js` se signal handlers hata diye, wo ab sirf `connectToDb` aur `disconnectDb` deta hai. Shutdown ka order `server.js` decide karta hai.
- `package.json`: `main` = `server.js`, scripts: `dev` (`nodemon server.js`), `start` (`node server.js`).
- **Bug jo mila:** `routes/auth.route.js` me `import ... from "../controllers/auth.controller"` bina `.js` ke tha. ESM me extension zaroori hai, warna `ERR_MODULE_NOT_FOUND`. Fix: `.js` add kiya.
- Verify kiya: health `200`, logout `200`, invalid google body `400`, aur real server pe `SIGTERM` bhejne par "Shutdown complete" aur exit code `0`.

### Step 14: Auth routes (`routes/auth.route.js`)
- **`logout` GET se POST kiya:** state change karne wala endpoint GET nahi hona chahiye. GET se `<img src=".../logout">` jaise tareeke se user ko chupke se logout karaya ja sakta hai (CSRF), aur browser prefetch bhi GET ko khud call kar deta hai.

```js
authRouter.post('/google', googleAuth);   // POST /api/auth/google
authRouter.post('/logout', logout);       // POST /api/auth/logout  (pehle GET tha)
```

- Route file me sirf URL + method ko controller se jodte hain, logic controller me. Mount path (`/api/auth`) `app.js` me hai, route file me nahi.
- Verify kiya: `POST /logout` `200`, `GET /logout` ab `404`.

### Step 15: Access + Refresh token auth (branch: `feat/access-refresh-token-auth`)
Pehle basic JWT tha: ek 7 din ka token, koi middleware nahi, logout sirf cookie clear, Google login me verification nahi. Isko standard production pattern me badla. Ye 8 sub-steps me hua, har sub-step me "kya, kyu, kahan".

> **Poora detail me samajhne ke liye:** [`virtualui-server/docs/AUTH_FLOW.md`](./virtualui-server/docs/AUTH_FLOW.md). Isme har flow (login, refresh, reuse detection, logout), har file ka role, tokens/cookies/DB, error codes, security decisions aur naya route add karne ka tareeka ek jagah hai.

**Poora flow ek nazar me:**

```
Login   : POST /google {idToken} -> Google verify -> accessToken (15m) + refreshToken (7d) cookies, refresh ka hash DB me
Request : cookie accessToken -> requireAuth verify (DB nahi) -> req.auth = { userId, role }
Expire  : 401 code TOKEN_EXPIRED -> frontend POST /refresh -> naya pair (rotation) -> request retry
Reuse   : purana refresh token dobara aaya -> poori family revoke -> dobara login
Logout  : POST /logout (ek device) ya /logout-all (saare devices) -> DB me revoke + cookies clear
```

**API:**

| Method | Route | Auth | Kaam |
|---|---|---|---|
| POST | `/api/auth/google` | public, rate limited | Google ID token se login/signup |
| POST | `/api/auth/refresh` | refresh cookie, rate limited | naya access + refresh token (rotation) |
| POST | `/api/auth/logout` | public | is device ka session revoke |
| POST | `/api/auth/logout-all` | `requireAuth` | saare devices se logout |
| GET | `/api/auth/me` | `requireAuth` | current user |

#### 15.1 Google ID token verification (`config/google.js`)
**Problem:** email/name `req.body` se aate the, koi bhi kisi ka bhi email bhej ke uske account me ghus sakta tha.
**Fix:** client sirf Google ka signed `idToken` bhejta hai. Server `google-auth-library` se signature, expiry, issuer aur **audience** verify karta hai, aur email/name token ke payload se leta hai.

```js
const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
```

- `audience` check zaroori hai, warna kisi doosri app ke liye bana Google token bhi chal jata.
- `email_verified` false ho to reject: unverified email se account bana/link ho to hijack ho sakta hai.
- Google ka `sub` (stable id) `User.googleId` me save hota hai (email badal sakta hai, `sub` nahi). Partial unique index: sirf un docs pe jinme googleId hai.
- Error pe generic `Invalid Google token`, detail nahi (attacker ko hint na mile).
- Client ke data pe trust nahi, ye rule hamesha.

#### 15.2 `requireAuth` middleware + `/me` (`middlewares/auth.middleware.js`)
Pehle token bana ke cookie me jata tha, par server uska kahin use nahi karta tha.

```js
router.get('/me', requireAuth, me);   // requireAuth: cookie -> verifyAccessToken -> req.auth
```

- Token stateless hai, isliye har request pe DB hit nahi.
- Status codes: `401` = tum authenticated nahi ho (missing/invalid/expired), `403` = ho, par permission nahi.
- Expired token ko alag `code: TOKEN_EXPIRED` milta hai. Frontend ise dekh ke `/refresh` call karke request retry karta hai (message text pe depend nahi karta).
- `/me` DB se fresh user padhta hai (token ka data purana ho sakta hai).

#### 15.3 `requireRole` middleware
```js
router.delete('/users/:id', requireAuth, requireRole('ADMIN'), handler);
```
- Factory function hai: alag routes pe alag roles. Hamesha `requireAuth` ke **baad**.
- Role access token me hai, to bina DB ke check hota hai. Trade-off: role badalne pe naya role max 15 min baad lagta hai.

#### 15.4 Access + Refresh token split (`config/token.js`, `utils/cookies.js`)
| | Access token | Refresh token |
|---|---|---|
| Life | 15 min | 7 din |
| Kaam | har API request | sirf naya access token lena |
| Secret | `JWT_SECRET` | `JWT_REFRESH_SECRET` (alag) |
| Cookie path | `/` | `/api/auth` (sirf auth endpoints pe jata hai) |

- Chhota access token: chori ho to damage limited. Lamba refresh token: user baar-baar login na kare.
- Dono `httpOnly` cookies me (JS se padhe nahi ja sakte, localStorage me XSS se seedha chori hota hai). `secure` production me, `sameSite: lax` (CSRF).
- Refresh cookie ka path chhota rakha: baaki requests ke saath ye nahi jata, exposure kam.
- `clearCookie` ko set ke **same options** chahiye (path, sameSite...), warna browser cookie delete nahi karta.

#### 15.5 Rotation + reuse detection + real logout (`models/session.model.js`, `services/session.service.js`)
Refresh token ka record DB me (`Session`): `jti`, `family`, `tokenHash`, `expiresAt`, `revokedAt`, `replacedBy`, `userAgent`, `ip`.

- **Hash store:** raw token DB me nahi, SHA-256 hash (password jaisa logic). DB leak se token use nahi ho sakta. Compare `timingSafeEqual` se.
- **Rotation:** har `/refresh` pe purana token revoke + naya issue (same `family`).
- **Reuse detection:** revoked token dobara aaye = chori ka signal (asli user aur attacker dono use kar rahe). Poori family revoke, dono ko dobara login.
- **Atomic claim:** do parallel requests same token se aayein to sirf ek jeetti hai:

```js
const claimed = await Session.updateOne({ _id: session._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
if (claimed.modifiedCount !== 1) { await revokeFamily(session.family); throw unauthorized(); }
```

- **Logout:** DB me family revoke + cookies clear (pehle sirf cookie hatti thi, token 7 din valid rehta). Idempotent: hamesha 200.
- **Logout all:** user ke saare active sessions revoke. Already issue hue access tokens max 15 min chalenge, phir sab band.
- **TTL index** (`expireAfterSeconds: 0`): expire hote hi MongoDB record khud delete kar deta hai.

#### 15.6 Claims cleanup (`config/token.js`)
```js
{ sub: userId, iss: "virtualui-server", aud: "virtualui:access" | "virtualui:refresh", jti, iat, exp, role(access only) }
```
- `userId` ki jagah standard `sub`. `iss`, `aud` verify me pin.
- `aud` alag hone se refresh token ko access token bana ke use nahi kar sakte (token confusion). Test me verify hua.
- Verify me `algorithms`, `issuer`, `audience` teeno pinned.

#### 15.7 Rate limiting + env validation + error handling
- **Rate limit** (`express-rate-limit`): `/google` pe 15 min me per IP limit, `429` (Step 16 me limits badli: authLimiter 100, refreshLimiter 300). Memory store single server ke liye theek; multiple servers me Redis store chahiye. Proxy ke peeche `TRUST_PROXY` set karo, warna sab ek IP dikhenge.
- **Env validation** (`config/env.js`): startup pe saare variables ek saath validate (secret >= 32 chars, dono secrets alag, `GOOGLE_CLIENT_ID` required...). Galat config pe server start hi nahi hota. `process.env` jagah-jagah nahi padhte, sab `env` object se.
- **Central error handler** (`ApiError` + `error.middleware.js`): `throw new ApiError(401, msg, code)` se ek jaisa JSON response. Unexpected errors pe client ko generic 500, poora error sirf server log me. Bad JSON `400`, badi body `413`, unknown route JSON `404`.
- Chhote hardening: `x-powered-by` band, `express.json({ limit: '10kb' })`.

#### 15.8 RS256 + key rotation (optional, `JWT_ALGORITHM=RS256`)
- HS256 me ek hi secret sign aur verify karta hai. RS256 me private key se sign, public key se verify: jab multiple services token verify karein to unhe secret nahi dena padta.
- Token header me `kid` (key id). Rotation: nayi key `JWT_KEY_ID=k2`, purani public key `JWT_PREVIOUS_PUBLIC_KEYS={"k1": "..."}` me, jab tak purane tokens expire na ho jayein. Phir purani key hata do.
- Default HS256 hai, RS256 tabhi lo jab zarurat ho.

**Env variables:** `.env.example` dekho. Naye: `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, optional `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, `TRUST_PROXY`, aur RS256 ke `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` / `JWT_KEY_ID` / `JWT_PREVIOUS_PUBLIC_KEYS`.

**Packages:** `google-auth-library`, `express-rate-limit`.

**Frontend ko ye karna hoga:** Google se `idToken` lekar `POST /api/auth/google {idToken}`; `credentials: 'include'` har request me; `401 TOKEN_EXPIRED` pe ek baar `/api/auth/refresh` call karke request retry; logout `POST`.

**Verify kiya** (temporary DB pe, Google verify stub karke, 11 tests): validation, invalid/unverified Google token, login cookies + hashed session, `/me` (missing/tampered token, refresh token as access), `requireRole` 403, rotation, reuse detection (poori family revoke), parallel refresh (sirf ek jeete), access expiry -> TOKEN_EXPIRED -> refresh, logout (DB se asli revoke), logout-all, error handling, rate limit 429. RS256: sign/verify, rotation (purani key se purana token chala), purani key hatane pe reject, HS256 token ko RS256 server pe reject. **Real Google token se end-to-end test nahi hua** (GOOGLE_CLIENT_ID chahiye).

**Known limitations (jaan-boojh ke):**
- Frontend me do tabs ek saath same refresh token bhejein to ek ko reuse maan ke family revoke ho sakti hai. Frontend me ek hi refresh request (single-flight) rakho. Aage chahiye to chhota grace window add kar sakte hain.
- Rate limiter in-memory hai (multi-server pe Redis).
- Role change 15 min tak purane role se chal sakta hai.
- Frontend alag domain pe ho to `sameSite: none` + `secure` + CSRF protection chahiye.

### Step 16: Email + password signup/login (branch: `feat/email-password-auth`)
User ab Google ke saath **email + password** se bhi signup/login kar sakta hai. Dono ke baad aage ka system same hai (wahi access + refresh tokens). Detail: `docs/AUTH_FLOW.md` (Flow 1b, 1c, 1d).

**Naye endpoints:** `POST /api/auth/signup {name,email,password}` (201, auto-login), `POST /api/auth/login {email,password}`.

**Naye/badle files:** `services/password.service.js` (naya), `models/user.model.js` (`passwordHash`, `emailVerified`), `controllers/auth.controller.js` (`signup`, `login`, Google linking), `middlewares/rateLimit.middleware.js` (`loginLimiter`, `refreshLimiter`), `routes/auth.route.js`. Package: `argon2`.

Kya seekha / kyu aise kiya:

- **Argon2id, SHA nahi:** password hash jaan-boojh ke slow aur memory-hungry hona chahiye. SHA-256/MD5 fast hain, attacker billions guesses/sec karta hai. Salt library khud banati hai aur hash string me rakhti hai.

```js
const passwordHash = await argon2.hash(password);          // "$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>"
await argon2.verify(passwordHash, password);
```

- **`passwordHash` `select: false`:** normal queries me field aati hi nahi, galti se response/log me leak nahi hoti. Login me `.select('+passwordHash')` se mangte hain.
- **Password length 8 se 128:** min NIST guideline. Max isliye ki bahut lamba password bhejke koi hashing me CPU/memory (DoS) kha sakta hai. Composition rules nahi lagaye (NIST bhi discourage karta hai), aur password trim nahi hota.
- **Login me user enumeration/timing se bachav:** galat email, galat password aur Google-only account teeno pe **ek jaisa** `401 INVALID_CREDENTIALS`. Email na mile tab bhi dummy hash verify chalta hai, taaki response time se registered emails na pata chalein.

```js
if (user?.passwordHash) isValid = await verifyPassword(user.passwordHash, password);
else await verifyAgainstDummy(password);   // timing barabar
```

- **Brute-force:** `loginLimiter` key = IP + email, 10 fail per 15 min (success count nahi). `authLimiter` (sirf IP) iske saath lagta hai, kyunki sirf IP+email pe attacker alag emails try karke (credential stuffing) bach jata.
- **Signup ek existing email ko touch nahi karta (409):** warna Google-only account pe signup se password set ho jata aur koi bhi kisi ke Google account me ghus jata.
- **Pre-hijacking attack ka fix:** attacker victim ka email apne password se signup kar de (email verify nahi hota), baad me victim Google se aaye aur hum account link kar dein, to attacker ka password chalta rahe. Isliye `emailVerified` field: Google se `true`, password signup me `false`. Google link pe unverified account ka **password hata dete hain aur saare sessions revoke**.

```js
if (!user.emailVerified) { user.set('passwordHash', undefined); await revokeAllUserSessions(user._id); }
user.googleId = profile.googleId; user.emailVerified = true;
```

- **Rehash on login:** `needsRehash(hash)` true ho (future me argon2 params badhayein) to login pe naye params se dobara hash.
- **Rate limits ka fix (bug jo test me mila):** `/refresh` aur `/signup`/`/login`/`/google` ek hi IP-limiter (30) share karte the. Office/NAT ke peeche kai users ek IP se aate hain aur har user har ~15 min me refresh karta hai, to asli users block ho jate. Ab: `authLimiter` 100, `refreshLimiter` 300 (alag), `loginLimiter` 10 per IP+email.
- **Verify kiya** (temporary DB, 20 tests, purane 11 + naye 9): signup validation, argon2id hash stored, no leaks, duplicate 409 (case-insensitive), Google-only email pe signup reject, login success/identical-401, timing (~65ms vs ~65ms), pre-hijacking neutralize (password gaya + attacker session revoke), brute-force 10 fails -> 429 (success count nahi, doosra email unaffected).

**Abhi nahi hai** (email infra chahiye): email verification, forgot/reset/change password, account lockout/CAPTCHA, common-password check.

### Step 17: Email verification, password reset/change, aur auth ke baaki gaps (branch: `feat/email-verification-and-password-reset`)
Auth flow me jo cheezein miss thi wo poori kari. Poora detail `virtualui-server/docs/AUTH_FLOW.md` me (ye doc ab poori tarah naye flows ke hisaab se rewrite hai).

**Naye endpoints:** `POST /verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`, `/change-password`.
**Behaviour badla:** signup ke baad user login **nahi** hota. Email verify karni padti hai, password login unverified pe `403 EMAIL_NOT_VERIFIED`.
**Mailer abhi skip:** email ki jagah link server console me print hota hai (`[DEV MAIL]` block). Production me console mail band hai.

**Naye files:** `models/emailToken.model.js`, `services/emailToken.service.js`, `services/mail.service.js`. Badle: controller, routes, `rateLimit.middleware.js`, `error.middleware.js`, `app.js`, `config/env.js`, `session.service.js`.

Kya seekha / kyu aise kiya:

- **Email token = random token + DB record, JWT nahi.** DB me hai to kabhi bhi delete/invalidate kar sakte hain (ek baar use hone pe, ya resend pe). JWT beech me cancel nahi hota. Raw token sirf email me jata hai, DB me SHA-256 hash (token already 256-bit random hai, to argon2 ki zarurat nahi).

```js
const token = randomBytes(32).toString('base64url');   // email me
tokenHash = sha256(token);                              // DB me
```

- **Verify aur reset ka mechanism same:** ek hi `EmailToken` model, `type` field se alag (verify 24h, reset 1h). Galat type ka token consume bhi nahi hota.
- **Token "ek baar" kaise:** `findOne` phir `deleteOne` aur `deletedCount === 1` check. Do requests ek saath aayein to sirf ek jeetti hai (session rotation wala atomic claim pattern).
- **Verify POST hai, GET nahi:** email scanners/link previews links khud khol dete hain, GET pe verify hota to user ke click ke bina hi ho jata. Verify ke baad auto-login bhi nahi (link leak ho to bhi koi andar nahi aata).
- **403 `EMAIL_NOT_VERIFIED` password sahi hone ke baad:** galat password wale ko verification state pata na chale. Google wale error ko alag code (`GOOGLE_EMAIL_NOT_VERIFIED`) diya, taaki frontend ka "resend" button galat jagah na aaye.
- **Forgot/resend hamesha ek jaisa 200 aur kaam background me:** registered email pe DB write + mail ka extra time lagta hai, wait karte to response time se email enumeration hota. Background me dono cases barabar.

```js
runInBackground('forgot password', async () => { const user = await User.findOne(...); if (user) await issueResetEmail(user); });
return res.status(200).json({ ...same body... });
```

- **Mail best-effort:** mail fail ho to flow nahi tootta, client ko pata nahi chalta (warna existence leak), error sirf server log me.
- **Console transport production me band:** logs me verify/reset links print hona khatarnak hai (logs padhne wala account hijack kar sakta hai). `setMailTransport(fn)` se asli provider lagana hai, flows ko kuch nahi badalna.
- **Reset password ka order:** validate + hash pehle, token consume baad me (weak password pe token waste na ho). Phir `emailVerified: true` (link inbox me gaya tha), baaki tokens delete, **saare sessions revoke**.
- **Change password:** current password maangte hain (chori hue access token se password na badle). Baaki devices ke sessions revoke, is device ke liye naya session. Google-only account ko `NO_PASSWORD_SET`: unhe "forgot password" se pehla password set karna hota hai (set-password re-auth ke bina allow karte to chori hue access token se attacker permanent password laga leta).
- **Naye rate limiters:** `emailActionLimiter` (IP+email, ghante me 5, email bombing roke), `credentialChangeLimiter` (IP+userId, change-password pe current password guessing roke).
- **Refresh pe unverified block:** `rotateSession` me `!emailVerified && !googleId` pe family revoke. Google-linked users verified maane jate hain, taaki purane (field se pehle bane) users logout na hon.
- **CORS add kiya:** `cors({ origin: CLIENT_URL, credentials: true })`. `"*"` cookies ke saath chalta hi nahi aur unsafe hai. `CLIENT_URL` env (dev default `http://localhost:5173`, production me required) email links ke liye bhi use hota hai.
- **Error handler me 2 mapping:** `CastError` (galat id format) `400`, E11000 (duplicate key) `409`, dono pehle `500` jate the.
- Google link pe purane email tokens delete (pre-hijacking cleanup ka hissa).

**Dev me kaise chalayein:** signup karo, server terminal me `[DEV MAIL]` block dikhega, usme token copy karke `POST /api/auth/verify-email {token}`. Phir login.

**Verify kiya** (temporary DB, 30 tests: 11 purane + 8 password + 11 naye): signup me cookies nahi, login 403 sirf sahi password pe, verify (invalid/tampered/GET/expired/one-time/type mismatch), resend (naya link purana band, identical 200, rate limit), forgot/reset (weak password pe token bachta hai, saare sessions revoke, token one-time, Google-only user password set kar sakta hai), change-password (doosre devices out, is device in, limiter), unverified refresh block, CORS (allowed/preflight/evil), CastError/E11000, console mail print aur mail fail pe signup 201. Real server pe bhi chalaya: `[DEV MAIL]` block print hua, aur production me console mail error deta hai.

**Abhi nahi hai:** asli mail provider, account lockout/CAPTCHA, active sessions list, common-password check.

### Step 18: `virtualui-client` scaffold (Vite + React)

- Client app Vite se bana: React 19, ESM (`"type": "module"`), ESLint flat config (`eslint.config.js`) + `react-hooks` / `react-refresh` plugins.
- Kyu Vite: CRA deprecated hai, Vite ka dev server (HMR) aur build fast hai.
- Template cleanup: default assets hata diye, title/favicon badla, Tailwind v4 add kiya (`tailwindcss` + `@tailwindcss/vite` plugin in `vite.config.js`, `@import "tailwindcss"` in `index.css`). Kyu: v4 me `tailwind.config.js`/PostCSS ki zaroorat nahi, Vite plugin se direct kaam karta hai.
- Abhi UI placeholder hi hai; auth APIs se connect karna aur `dyninno-virtualui-lib` use karna baaki hai.

---

## Pending
- Version bump + publish (`dyninno-virtualui-lib`).
- `peerDependencies` range chowda karna, types (`dts`) aur `exports` map.
- Auth: **asli mail provider** (Resend/SendGrid/SES) `setMailTransport` se lagana (production se pehle zaroori), real Google login end-to-end test (`GOOGLE_CLIENT_ID` bharna hai), rate limiter ke liye Redis store (multi-server), refresh me grace window (multi-tab), account lockout/CAPTCHA, active sessions list, common-password check.
- Server: `nodemon` ko devDependency banana, proper logger (pino), helmet, request validation library (zod), automated tests ko repo me add karna (`node --test`).
- `virtualui-client`: default template hata ke login/signup UI banana, server auth APIs se connect karna.

Component props/usage: [`virtualui-lib/README.md`](./virtualui-lib/README.md)
