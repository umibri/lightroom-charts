# Testing — Local Catalog Load

**Goal:** Load a Lightroom catalog in the browser and confirm the app can query it.

## Quick setup

- `npm install`
- Test both **dev** (`npm run dev`) and **preview** (`npm run build && npm run preview`).

## Primary flow

1. Visit `#/load` (the root URL redirects there).
2. Pick a valid `.lrcat` or `.db`.
3. You should see “Initializing…”, then get sent to `#/stats`.
4. `#/stats?range=24m` shows the file name and photo count, then four charts: photos per month, lenses, cameras, ISO. The timeline's total matches `npm run inspect -- <same file> --from <first month shown>`.
5. Date range: 12 months / All update every chart; Custom shows two month inputs, and typing quickly commits only the settled value (one query).
6. In dev only, `#/debug` lists tables and Top-15 cameras/lenses for the last two years.

## Edge cases

- **Wrong file type**: a non-`.lrcat`/`.db` file shows “That’s not a Lightroom catalog” and names the file. Choosing the same file again still responds.
- **Drop anywhere**: dropping a file outside the drop zone is handled by the app; the browser never navigates to the file.
- **Retry**: read and open failures (and out-of-memory) offer **Try again** with the same file.
- **Demo**: **Try with sample data** opens a generated catalog with a **Demo data** badge.
- **Reopen (Chrome/Edge desktop)**: pick a catalog by clicking the drop zone (system picker) or by dropping it, open it, then reload. Load shows **Reopen <name>** with when it was last opened. Reopen asks to allow reading the file once, then goes straight to Stats. **Forget** removes it. A catalog that was moved or deleted is reported and forgotten. Firefox/Safari: no Reopen card; loading works as before. Automated in `e2e/reopen.spec.ts` with a handle from the origin-private file system, since Playwright can't drive the native picker.
- **Renamed non-database** (e.g. a `.txt` renamed to `.lrcat`): “isn’t a SQLite database”.
- **Other SQLite database**: “a database, but not a Lightroom Classic catalog”.
- **Large file (≥ 500 MB)**: a warning with the size and **Open anyway** / **Cancel**.
- **Not initialized**: opening `#/stats` directly or after a reload redirects to `#/load?from=stats`, which explains that catalogs live only in the tab's memory.
- **Empty range**: a custom range with no photos shows “No photos in this date range”.

Automated: `npm run e2e` covers the flows above at 1280×800 and Pixel 7 sizes and saves chart screenshots under `test-results/`.

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
