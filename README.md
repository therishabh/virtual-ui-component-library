# Virtual UI Library Project

React component library (`virtualui-lib`). Ye README learning diary hai: sirf wo cheezein jo kaam ki hain, aur **kyu** aise kiya.

## Structure

```
virtualui-lib/
├── src/
│   ├── components/{Button,Card}/*.jsx
│   └── index.js          # public API (named exports)
├── tsup.config.js
└── package.json
virtualui-server/         # Express 5 backend (ESM)
virtualui-client/         # abhi khali
```

## Learnings

### Components ka pattern
- Defaults destructuring me hi set kiye (`variant = "primary"`), `defaultProps` nahi. React 19 me function components ke liye `defaultProps` hata diya gaya hai.
```jsx
const Button = ({ children = "Button", variant = "primary", size = "md", style = {}, ...rest }) => (
  <button style={{ ...variants[variant], ...sizes[size], ...style }} {...rest}>
    {children}
  </button>
);
```

- `...rest` native element pe spread hota hai, taaki `aria-*`, `data-*`, `className`, handlers bina props declare kiye kaam karein.
- `style` last me spread hota hai, taaki consumer variant/size ke styles override kar sake (later key wins).
- Variants/sizes ko object map (`variants[variant]`) rakha, if/else chain nahi. Naya variant = ek key:

```js
const variants = {
  primary: { background: "#2563eb", color: "#fff" },
  outline: { background: "transparent", color: "#2563eb" },
};
```

- Inline styles ki limitation: `:hover`, `:focus`, media queries nahi chalte. Library ko real theming chahiye to CSS variables ya CSS-in-JS pe jana padega.

### Bundling (tsup)
```js
// tsup.config.js
export default defineConfig({
  entry: ["src/index.js"],
  format: ["esm", "cjs"],
  external: ["react"],
  dts: false,
  clean: true,
});
```

- `format: ["esm", "cjs"]`: ESM (`index.mjs`) modern bundlers ke liye, tree-shaking milti hai. CJS (`index.js`) purane tooling/Node `require` ke liye.
- `external: ["react"]`: react bundle me aa gaya to consumer ke app me **do React copies** ho jayengi aur hooks me "Invalid hook call" aayega. Isliye `peerDependencies` + `external`, dono zaroori.
- `src/index.js` me `.jsx` import hote hain; esbuild (tsup ke andar) JSX khud handle karta hai.
- Classic JSX transform me `React` import chahiye (`React.createElement`). IDE ka "React unused" warning false alarm hai, import hatana nahi hai.
- `dts: false`: abhi types nahi ban rahe. TS users ko autocomplete/type safety nahi milegi. Fix: `dts: true` (+ `.d.ts` source ya JS ke liye JSDoc).

### package.json ke fields
```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "files": ["dist"],
  "peerDependencies": { "react": "^19.3.0" }
}
```

- `main` → CJS, `module` → ESM. Modern Node/bundlers ke liye `exports` map better hai (dono formats ko explicitly map karta hai, deep imports block karta hai). Abhi add nahi kiya:

```json
"exports": {
  ".": { "import": "./dist/index.mjs", "require": "./dist/index.js" }
}
```

- `files: ["dist"]`: tarball me sirf build output jata hai. README aur package.json hamesha include hote hain.
- `peerDependencies.react: ^19.3.0` bahut tight hai. React 18 users pe install warning aayegi. Wide range: `"react": "^18 || ^19"`.

### npm publish gotchas
- Pehle `npm pack --dry-run` se dekho ki tarball me kya ja raha hai.
- Version bump + publish:

```bash
npm version patch   # 1.0.0 -> 1.0.1
npm publish
```

- Ek baar publish hua version dobara publish nahi hota, na hi overwrite. Error: `You cannot publish over the previously published versions: 1.0.0`. Fix: `npm version patch` phir publish.
- Package name `dyninno-virtualui-lib`. Naam change karne pe version history naye naam se alag hoti hai, par agar naam pe 1.0.0 pehle se hai to wahi error aata hai.

### virtualui-server (Express 5)
- ESM backend: `"type": "module"` hai, isliye `import express from 'express'` chalta hai, `require` nahi.
- Express 5 choose kiya: async route handlers me rejected promise/throw automatically error middleware tak jata hai, `try/catch` ya wrapper ki zarurat nahi.
- Dependencies: `express`, `mongoose`, `jsonwebtoken`, `cookie-parser`, `cors`, `dotenv`. Abhi sirf express use ho raha hai, baaki aage auth/DB ke liye.
- `nodemon` dependencies me hai, jabki ye devDependency hona chahiye (production install me bekar jayega).
- Abhi sirf health-check route hai:

```js
app.get('/', (req, res) => {
  res.status(200).json({ message: "success", status: true });
});
app.listen(8000);
```

- `npm run dev` → `nodemon index.js` (file change pe auto-restart).
- `PORT` hardcoded `8000` hai; `dotenv` aane ke baad `process.env.PORT ?? 8000` karna better.

## Pending
- Version bump + publish.
- `peerDependencies` range chowda karna.
- Types (`dts`) aur `exports` map.
- Server: `nodemon` ko devDependency banana, PORT env se, `.env` + DB connect + CORS/cookie middleware.
- `virtualui-client` abhi khali hai.

Component props/usage: [`virtualui-lib/README.md`](./virtualui-lib/README.md)
