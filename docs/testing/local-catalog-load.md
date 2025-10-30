# Testing — Local Catalog Load

**Goal:** Load a Lightroom catalog in the browser and confirm the app can query it.

## Quick setup

- `npm i`
- Test both **dev** and **preview**: `vite build && vite preview`

## Primary flow

1. Visit `/load`.
2. Pick a valid `.lrcat` or `.db`.
3. You should see “Initializing…”, then get sent to `/stats`.
4. `/stats` should show: `Smoke test: {"ok":1}`.

## Edge cases

- **Wrong file type**: Selecting a non-`.lrcat`/`.db` should show a clear error.
- **Large file (≥ 500 MB)**: You should see a warning with **Proceed** / **Cancel**.
- **Not initialized**: Going to `/stats` first should show a “Catalog not initialized” message.

## Build parity checks

- In **preview**, the Network tab should show exactly **one** request for `sql-wasm.wasm`.
- No worker import/module errors.

## Memory sanity

- Loading a big file should show one noticeable memory bump during read, not two (zero-copy transfer).
