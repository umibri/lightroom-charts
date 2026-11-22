# Testing — Local Catalog Load

**Goal:** Load a Lightroom catalog in the browser and confirm the app can query it.

## Quick setup

- `npm install`
- Test both **dev** (`npm run dev`) and **preview** (`npm run build && npm run preview`).

## Primary flow

1. Visit `#/load` (the root URL redirects there).
2. Pick a valid `.lrcat` or `.db`.
3. You should see “Initializing…”, then get sent to `#/stats`.
4. `#/stats` should show: `Smoke test: {"ok":1}`.
5. In dev only, `#/debug` lists tables and Top-15 cameras/lenses for the last two years.

## Edge cases

- **Wrong file type**: Selecting a non-`.lrcat`/`.db` should show a clear error.
- **Large file (≥ 500 MB)**: You should see a warning with **Proceed** / **Cancel**.
- **Not initialized** (known gap, fixed in Phase 2): opening `#/stats` directly or after a reload shows “Query failed”, because the catalog lives only in the worker's memory.

## Build parity checks

- In **preview**, the Network tab should show exactly **one** request for `sql-wasm-*.wasm`.
- No worker import/module errors.
- On a fresh dev cache (`rm -rf node_modules/.vite`), loading a catalog must **not** trigger a page reload (guarded by `optimizeDeps.include: ['sql.js']`).

## Memory

The file's `ArrayBuffer` is transferred to the worker without copying, but sql.js then copies the bytes into its in-memory file system, so peak memory is roughly 2× the catalog size while opening. Phase 1 measures this on a large catalog.
