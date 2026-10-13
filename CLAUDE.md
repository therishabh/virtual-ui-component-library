# Virtual UI Library Project – Claude Instructions

## README.md rules (user ne bola hai, hamesha follow karna)

Root `README.md` is project ki **learning diary** hai. Isse padhke knowledge milni chahiye: kya kiya, **kyu** kiya, aur kaunsi gotchas mili. Ye book jaisi lambi nahi honi chahiye.

- **Structure chronological hona chahiye**: `Step 1, Step 2, ...` timeline ke order me (purana upar, naya neeche). Topic-wise (bundling, package fields, etc.) sections mat banao, warna flow samajh nahi aata ki kab kya kiya. Naya kaam = naya Step append karo; concept us Step ke andar hi likho.
- User jab bhi koi kaam kare/karwaye (feature, config change, package, fix, error), README me uski entry add/update karo. Puraana content mat hatao, sirf update/append karo.
- **Jab bhi user commit kare**, usse pehle README update karo: is commit me kya naya hua aur kyu.
- User fresher nahi hai. **Basic cheezein mat likho**: `git init/add/commit/push`, `npm install`, folder banana, etc. Sirf concepts, design decisions, trade-offs, errors aur unke fix likho.
- Har entry me "kya" ke saath **"kyu"** zaroor likho (jaise `external: ["react"]` kyu, `defaultProps` ki jagah destructuring kyu).
- Jahan zaroori ho, chhota aur relevant **code snippet** daalo (config, key code, error message + fix).
- Style: crisp, simple Hinglish/English, chhote points. Bookish/formal language nahi.
- Naye packages, config options aur folder structure me badlav ka mention karo.
- Pending/TODO items README ke `Pending` section me rakho aur kaam hone pe update karo.

## Working rules

- Code me comments **Hinglish** me likho (simple, crisp). Jahan "kyu" non-obvious ho wahan comment do, har line pe nahi.

- Jab user bole "sirf in files me changes karo", un files ke bahar kuch mat badlo.
- Outward-facing kaam (npm publish, git push, etc.) tabhi karo jab user explicitly bole.
- Git commit me trailer lagana hai (hook enforce karta hai): `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Project info

- Virtual UI component library, React (peer dep), source `virtualui-lib/src`.
- Package: `virtualui-lib/` (npm name `dyninno-virtualui-lib`), build tool `tsup` (ESM + CJS, `react` external).
- Components: `Button`, `Card` (`src/components/<Name>/<Name>.jsx`), exported from `src/index.js`.
- Folders: `virtualui-lib` (package), `virtualui-client`, `virtualui-server` (abhi khali).
- Repo: https://github.com/therishabh/virtual-ui-component-library (branch `main`).
- `.gitignore` root pe hai (`node_modules`, `dist`, `.env*` ignore).
