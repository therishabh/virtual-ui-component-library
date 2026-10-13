# Virtual UI Library Project

A React component library project.

## Structure

```
Virtural UI Library Project/
└── virtualui-lib/        # The npm package (source, build config, package README)
    ├── src/
    │   ├── components/
    │   │   ├── Button/Button.jsx
    │   │   └── Card/Card.jsx
    │   └── index.js      # Library entry point
    ├── tsup.config.js    # Build config (ESM + CJS)
    └── package.json
```

## Getting Started

```bash
cd virtualui-lib
npm install
npm run build
```

The build output is generated in `virtualui-lib/dist`.

## Components

- **Button**: configurable button with `variant`, `size`, `disabled` and more.
- **Card**: simple container with `title`, `footer`, `elevated` and `padding`.

See [`virtualui-lib/README.md`](./virtualui-lib/README.md) for full props and usage.

## Publishing

```bash
cd virtualui-lib
npm version patch
npm publish
```

## Author

Rishabh Agrawal
