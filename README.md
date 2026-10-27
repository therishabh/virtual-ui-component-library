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
virtualui-client/         # abhi khali
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

### Step 15: `virtualui-client` (Vite + React 19)

- Vite se scaffold (CRA deprecated; Vite ka dev server/HMR fast). ESM + ESLint flat config.
- **Tailwind v4**: `npm i tailwindcss @tailwindcss/vite`, phir:

  ```js
  // vite.config.js
  import tailwindcss from '@tailwindcss/vite'
  export default defineConfig({ plugins: [react(), tailwindcss()] })
  ```

  ```css
  /* src/index.css */
  @import 'tailwindcss';
  ```

  Kyu: v4 me `tailwind.config.js`/PostCSS/`@tailwind` directives nahi chahiye; Vite plugin classes khud scan karta hai.
- `react-router-dom` v7 + `react-icons`; `main.jsx` me `<App />` ko `<BrowserRouter>` se wrap kiya. Folders: `src/pages/` (`Home.jsx`), `src/components/` (`Auth.jsx`).

### Step 16: Frontend port fix (Vite)

```js
// vite.config.js
server: { port: 5173, strictPort: true },
preview: { port: 4173, strictPort: true },
```

- Kyu `strictPort`: default me port busy ho to Vite chupchaap `5174` pe chala jata hai. Backend CORS origin aur Firebase authorized domains `5173` ke hisaab se set hote hain, to wo silently toot jaate. `strictPort` se seedha error aata hai.

### Step 17: CORS fix (`app.js`)

```js
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }));
```

- **Bug tha**: `origin: ""`. Empty string falsy hai, `cors` usse `"*"` maan leta hai, aur `*` + `credentials: true` ko browser reject kar deta hai. Cookie wala login kabhi kaam nahi karta.
- Fix: explicit frontend origin, env (`CLIENT_URL`) se, taaki prod me alag URL ho sake.
- `cors()` sabse upar rakha, taaki preflight `OPTIONS` routes se pehle handle ho.
- Cookie flow ke liye client pe `withCredentials: true` bhi chahiye (axios me already hai).

### Step 18: Google login 400 error fix (`Auth.jsx`)

- **Error**: `AxiosError: Request failed with status code 400`. Server ka validation fail ho raha tha (`name`/`email` string nahi the).
- **Root cause**: `const {email, name} = response.user`. Firebase user object me `name` field hota hi nahi, field ka naam `displayName` hai. To `name` hamesha `undefined` jata tha.
- **Fix**:

  ```js
  const {email, displayName} = response.user;
  const name = displayName ?? email?.split('@')[0]; // displayName kuch accounts me null hota hai
  ```

- **Debugging tip**: axios ka message ("status code 400") useless hota hai. Server ka asli message `error.response?.data` me hota hai, isliye catch me wahi print kiya.
- Verify: login chal gaya, cookie set hui (CORS + `withCredentials` ka Step 17 wala setup kaam aaya).

### Step 19: Axios instance (`src/utils/api.js`)

```js
export const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    withCredentials: true,
    timeout: 10_000,
});
```

- Kyu: `baseURL` aur `withCredentials` har call me repeat karne se koi call me `withCredentials` bhool jao to cookie silently nahi jayegi. Instance me ek baar set, ab `api.post('/api/auth/google', body)`.
- `timeout` default me 0 (infinite) hota hai, server hang ho to UI latka rehta hai. Isliye 10s set kiya.
- `getErrorMessage(error)`: `axios.isAxiosError` se check karke `error.response.data.message` nikalta hai (Step 18 wala gotcha ek helper me).
- Auth.jsx se `axios` import aur `SERVER_URL` const hata diya.

### Step 20: Central env config (`virtualui-server/config/env.js`)

```js
import 'dotenv/config';
const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing required env variables: ${missing.join(', ')}`);

export const env = Object.freeze({
    isProduction: process.env.NODE_ENV === 'production',
    PORT: Number(process.env.PORT) || 8000,
    CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
});
```

- Kyu: `process.env` har file me bikhra tha (db, token, app, server, controller). Typo pe silently `undefined`, defaults alag-alag jagah. Ab sirf `env.js` me `process.env` hai, baaki sab `import { env }`.
- **Fail fast**: required vars missing ho to startup pe ek hi error me saare naam aate hain. Pehle `undefined` request ke beech crash karta tha.
- **`dotenv` ab `env.js` ke andar**: ESM imports hoist hote hain, to "server.js me dotenv sabse upar rakho" wala order fragile tha. Ab jo bhi `env` import kare, `.env` pehle load ho chuka hota hai. Isse `db.js`/`token.js` ka "function ke andar read karo" workaround bhi hat gaya (`getSecret()` delete).
- `PORT` ko `Number()` me convert kiya (env hamesha string hota hai), `Object.freeze` se runtime me value badalne se bachav.
- Abhi `JWT_REFRESH_SECRET` aur `GOOGLE_CLIENT_ID` `.env` me hain par code me use nahi hote, isliye `env.js` me nahi daale. Use shuru karo to `env` me add karna aur `REQUIRED` me daalna.

### Step 21: Auth middleware (`middlewares/auth.middleware.js`) + `GET /api/auth/me`

```js
const isAuth = (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (!token) return res.status(401).json({ status: false, message: "User should be logged in" });
        req.userId = verifyToken(token).userId;
        next();
    } catch {
        return res.status(401).json({ status: false, message: "Invalid or expired token" });
    }
};
```

Pehle version me ye bugs the (gotchas):
- **Empty `catch`**: `jwt.verify` invalid/expired token pe throw karta hai. Catch khaali tha to na response jata tha, na `next()`. Request **hang**, frontend ko 401 hi nahi milta. Ab catch 401 bhejta hai.
- **`return` missing**: token na ho to `res.json()` ke baad function chalta rehta tha, `verifyToken(undefined)` throw karta. Response bhejte waqt hamesha `return` lagao.
- **400 vs 401**: login nahi / token galat = 401 (auth fail), 400 bad request hota hai.
- **Import me `.js` extension**: ESM me bina extension `ERR_MODULE_NOT_FOUND`.
- **File name casing**: file `auth.middleware.js` thi par import `Auth.middleware.js`. macOS case-insensitive hai to chal jata, Linux (Docker/CI) pe fail. Project convention lowercase hai, to wahi rakha.
- **Extension bhoolne se permanent bachav**: Node ESM me `.js` hatana possible nahi. `.vscode/settings.json` me `importModuleSpecifierEnding: "js"` set kiya, to VS Code auto-import khud `.js` lagata hai (manual typing pe kaam nahi karta). Next level: `package.json` `imports` (`#config/*`) ya ESLint `import/extensions`.
- `req.userId` set kiya taaki aage controllers token dubara decode na karein. `console.log` of payload hata diya (token data logs me nahi jana chahiye). `async` hataya, `verifyToken` sync hai.

---

## Pending
- Version bump + publish (`dyninno-virtualui-lib`).
- `peerDependencies` range chowda karna.
- Types (`dts`) aur `exports` map.
- Auth: Google ID token verify (`google-auth-library`), central error middleware.
- Auth routes pe rate limiting (`express-rate-limit`), brute-force/abuse se bachne ke liye.
- Server: `nodemon` → devDependency, env validation (`config/env.js`), proper logger (pino), CORS/cookie middleware.
- `virtualui-client`: auth UI banana aur server APIs se connect karna.

Component props/usage: [`virtualui-lib/README.md`](./virtualui-lib/README.md)

---

## Reference: explored but reverted

### Firebase ID token verify + `firebaseUid` (security fix)

> **Status: revert kiya (code me nahi hai).** Ye approach implement ki thi (live login pe test nahi hui), phir hata di. Sirf seekhne ke liye yahan rakha hai, jab dobara chahiye ho to isse reuse karo.
**Problem**: client `{name, email}` body me bhejta tha, server trust karta tha. Koi bhi kisi ka email bhej ke uska account use kar sakta tha. Email identifier ke liye bhi kamzor hai (badal/recycle ho sakta hai).

**Flow ab**:

```js
// client
const idToken = await response.user.getIdToken();
await api.post('/api/auth/google', { idToken });

// server (config/firebase.js)
const app = initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
export const verifyIdToken = (idToken) => getAuth(app).verifyIdToken(idToken);
```

- Server `uid`, `email`, `email_verified`, `name` **verified token ke payload** se leta hai, body se nahi.
- **Service account key nahi chahiye**: `verifyIdToken` Google ke public certs se signature check karta hai, sirf `projectId` kaafi hai (key sirf admin kaam ke liye). `audience` check se kisi aur project ka token reject hota hai. `FIREBASE_PROJECT_ID` ko `env.js` me required kiya.
- **Model**: `firebaseUid` (stable ID), unique + **sparse** index. Sparse kyu: purane users me field hi nahi hai, sparse ke bina sab `null` ban ke unique constraint tod dete.
- **Lookup**: pehle `firebaseUid` se. Nahi mila to purane user ko email se dhundh ke `uid` link karte hain (`findOneAndUpdate` + `$exists: false`). Ye tabhi safe hai jab email verified token se aaya ho, isliye `email_verified` check kiya.
- **Status codes**: invalid/expired token `401`, unverified email `403`, email kisi aur uid se linked `409`. Sirf `auth/...` errors ko 401 banate hain; certs fetch fail jaisi asli server errors upar jaate hain.
- **Gotcha**: ID token ~1 ghante me expire hota hai, isliye har login pe naya `getIdToken()` lo. Session ke liye apna JWT cookie hai.
