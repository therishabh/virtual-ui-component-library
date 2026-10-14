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

---

## Pending
- Version bump + publish (`dyninno-virtualui-lib`).
- `peerDependencies` range chowda karna.
- Types (`dts`) aur `exports` map.
- Server: `nodemon` → devDependency, env validation (`config/env.js`), proper logger (pino), CORS/cookie middleware.
- `virtualui-client` abhi khali hai.

Component props/usage: [`virtualui-lib/README.md`](./virtualui-lib/README.md)
