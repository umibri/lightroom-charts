# Lightroom Charts

Local, privacy-first photo analytics. Open a Lightroom Classic catalog (`.lrcat`) in your browser and explore charts about your photos — the file is read entirely on your machine and never uploaded.

**Live:** https://umibri.github.io/lightroom-charts/

> Close Lightroom before loading your catalog. While Lightroom is open, recent edits can sit in the `.lrcat-wal` side file, which this app does not read.

## How it works

There is no backend. The catalog is a SQLite database; the app opens it with [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly) inside a Web Worker and runs read-only queries there, so the UI thread stays responsive.

```
UI (React)  ──Comlink──▶  Web Worker  ──▶  sql.js (WASM SQLite, in-memory copy of the catalog)
```

## Tech stack

- **Build/UI:** Vite 8 · React 19 · TypeScript 5.9
- **Styling:** Tailwind CSS 4
- **Routing:** TanStack Router (hash history, so deep links work on GitHub Pages)
- **DB (browser):** sql.js in a Web Worker via Comlink
- **Tests:** Vitest
- **Quality:** ESLint 10 (flat config) · Prettier 3 · Husky + lint-staged
- **CI/CD:** GitHub Actions — checks on every PR, deploy to GitHub Pages on `main`

## Getting started

Requires Node 22.22+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

| Script            | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Dev server                                  |
| `npm run build`   | Typecheck + production build to `dist/`     |
| `npm run preview` | Serve the production build locally          |
| `npm test`        | Unit tests (Vitest)                         |
| `npm run lint`    | ESLint                                      |
| `npm run format`  | Prettier (write)                            |
| `npm run verify`  | Lint, format check, tests, build (pre-push) |

In dev, `#/debug` shows a schema explorer for the loaded catalog. It is not included in production builds.

## License

MIT — see [LICENSE](LICENSE).
