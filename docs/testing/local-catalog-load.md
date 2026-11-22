# Testing — Local Catalog Load

**Goal:** Load a Lightroom catalog in the browser and confirm the app can query it.

## Quick setup

- `npm install`
- Test both **dev** (`npm run dev`) and **preview** (`npm run build && npm run preview`).

## Primary flow

1. Visit `#/load` (the root URL redirects there).
2. Pick a valid `.lrcat` or `.db`.
3. You should see “Initializing…”, then get sent to `#/stats`.
4. `#/stats` should show the catalog summary (photos, videos, virtual copies, date range, cameras, lenses). `npm run inspect -- <same file>` prints the same numbers.
5. In dev only, `#/debug` lists tables and Top-15 cameras/lenses for the last two years.

## Edge cases

- **Wrong file type**: Selecting a non-`.lrcat`/`.db` should show a clear error.
- **Renamed non-database** (e.g. a `.txt` renamed to `.lrcat`): “isn’t a SQLite database”.
- **Other SQLite database**: “a database, but not a Lightroom Classic catalog”.
- **Large file (≥ 500 MB)**: You should see a warning with **Proceed** / **Cancel**.
- **Not initialized**: opening `#/stats` directly, after a reload, or after a failed open shows “No catalog is open” with a link to Load.

## Build parity checks

- In **preview**, the Network tab should show exactly **one** request for `sql-wasm-*.wasm`.
- No worker import/module errors.
- On a fresh dev cache (`rm -rf node_modules/.vite`), loading a catalog must **not** trigger a page reload (guarded by `optimizeDeps.include: ['sql.js']`).

## Memory

The `File` handle is passed to the worker and read there, so the main thread never holds the bytes. Inside the worker the file's bytes and sql.js's in-memory copy coexist while opening, then the input is released:

| Stage (1 GB catalog, measured in Node with the same sql.js build) | Memory |
| ----------------------------------------------------------------- | ------ |
| File read                                                         | ~1 GB  |
| During open (input + sql.js copy)                                 | ~2 GB  |
| After open                                                        | ~1 GB  |

The same 1 GB catalog opened through the app in Chrome in under 5 seconds (dev server, Apple Silicon). If multi-GB catalogs turn out to fail on real devices, the fallback is a read-only engine that reads slices of the `File` on demand (wa-sqlite with a custom VFS) instead of copying it.
