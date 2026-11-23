// Remember the last opened catalog so it can be reopened without picking it
// again. Uses the File System Access API (Chromium desktop browsers): we keep a
// *handle* to the file in this browser's IndexedDB, never the file's contents,
// and nothing leaves the browser. Elsewhere every function here quietly reports
// "unsupported" and the app behaves as before.

// Chromium-only parts of the API that TypeScript's DOM lib doesn't include.
type ReadPermission = { mode: 'read' };
interface PermissionedHandle extends FileSystemFileHandle {
  queryPermission?(d: ReadPermission): Promise<PermissionState>;
  requestPermission?(d: ReadPermission): Promise<PermissionState>;
}
interface PickerWindow {
  showOpenFilePicker?(options: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle[]>;
}
interface HandleItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

export interface RecentCatalog {
  handle: FileSystemFileHandle;
  name: string;
  /** ms since epoch of the last successful open. */
  savedAt: number;
}

const DB = 'lightroom-charts';
const STORE = 'kv';
const KEY = 'recent-catalog';

/** True where we can get a reusable file handle and store it. */
export function canRemember(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showOpenFilePicker === 'function' &&
    typeof indexedDB !== 'undefined'
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Storage can be blocked (private windows, site settings); the feature then just stays off. */
export async function loadRecent(): Promise<RecentCatalog | null> {
  if (!canRemember()) return null;
  try {
    const v = await tx<RecentCatalog | undefined>('readonly', (s) => s.get(KEY));
    return v && v.handle && typeof v.name === 'string' ? v : null;
  } catch {
    return null;
  }
}

export async function saveRecent(handle: FileSystemFileHandle, now = Date.now()) {
  if (!canRemember()) return;
  try {
    const value: RecentCatalog = { handle, name: handle.name, savedAt: now };
    await tx('readwrite', (s) => s.put(value, KEY));
  } catch {
    /* not remembered; nothing else depends on it */
  }
}

export async function forgetRecent() {
  try {
    await tx('readwrite', (s) => s.delete(KEY));
  } catch {
    /* already gone or storage blocked */
  }
}

/**
 * Ask for a catalog with the system picker. Returns null if the user cancels.
 * Accept list mirrors the file input's.
 */
export async function pickCatalogHandle(): Promise<FileSystemFileHandle | null> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) return null;
  try {
    const [handle] = await picker({
      multiple: false,
      types: [
        {
          description: 'Lightroom catalog',
          accept: { 'application/octet-stream': ['.lrcat', '.db'] },
        },
      ],
    });
    return handle ?? null;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return null; // cancelled
    throw e;
  }
}

/**
 * Handles for dropped files. Must be called synchronously inside the drop
 * event (the data transfer is emptied afterwards); resolve the promises later.
 */
export function dropHandles(dt: DataTransfer | null): Promise<FileSystemFileHandle | null>[] {
  if (!dt) return [];
  return Array.from(dt.items)
    .filter((it) => it.kind === 'file')
    .map((it) => {
      const get = (it as unknown as HandleItem).getAsFileSystemHandle;
      if (typeof get !== 'function') return Promise.resolve(null);
      return get
        .call(it)
        .then((h) => (h && h.kind === 'file' ? (h as FileSystemFileHandle) : null))
        .catch(() => null);
    });
}

export type ReopenResult =
  { ok: true; file: File } | { ok: false; reason: 'denied' | 'missing' | 'failed' };

/**
 * Get the File behind a remembered handle. The browser asks the user to allow
 * reading it again (only on a user action, e.g. a click), then reads the
 * current version of the file from disk.
 */
export async function fileFromHandle(handle: FileSystemFileHandle): Promise<ReopenResult> {
  const h = handle as PermissionedHandle;
  try {
    let state: PermissionState = (await h.queryPermission?.({ mode: 'read' })) ?? 'granted';
    if (state !== 'granted') state = (await h.requestPermission?.({ mode: 'read' })) ?? 'denied';
    if (state !== 'granted') return { ok: false, reason: 'denied' };
    return { ok: true, file: await handle.getFile() };
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === 'NotFoundError' || name === 'NotReadableError')
      return { ok: false, reason: 'missing' };
    if (name === 'NotAllowedError' || name === 'SecurityError')
      return { ok: false, reason: 'denied' };
    return { ok: false, reason: 'failed' };
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "3 days ago", or a date, by local calendar day. */
export function lastOpenedText(savedAt: number, now = Date.now()): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(now) - startOf(savedAt)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `on ${new Date(savedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
