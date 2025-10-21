# Lightroom Charts

Local, privacy-first photo analytics. Load a Lightroom catalog (`.lrcat`/`.db`) in your browser and explore simple charts—without uploading data to a server.

---

## Tech Stack

- **Build/UI:** Vite 7 · React 18+ · TypeScript
- **Styling:** Tailwind CSS
- **Routing:** Tanstack Router
- **DB (browser):** `sql.js` (WASM SQLite) running in a **Web Worker**
- **Quality:** ESLint (Flat Config) · Prettier 3 · Husky + lint-staged
