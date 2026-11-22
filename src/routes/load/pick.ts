import type { CatalogErrorCode } from '@/catalog/validate.ts';

/** Above this, warn before opening: the whole catalog is held in memory. */
export const LARGE_BYTES = 500 * 1024 * 1024;

export type PickResult =
  | { kind: 'none' }
  | { kind: 'wrong-type'; name: string }
  | { kind: 'large'; file: File }
  | { kind: 'ok'; file: File };

const ALLOWED = ['.lrcat', '.db'];

/**
 * Decide what to do with dropped/chosen files. Prefers a .lrcat when several
 * are dropped at once (e.g. the catalog plus its -wal and Previews files).
 */
export function pickCatalog(files: ArrayLike<File> | null | undefined): PickResult {
  const list = files ? Array.from(files) : [];
  if (list.length === 0) return { kind: 'none' };
  const lower = (f: File) => f.name.toLowerCase();
  const file =
    list.find((f) => lower(f).endsWith('.lrcat')) ??
    list.find((f) => ALLOWED.some((ext) => lower(f).endsWith(ext)));
  if (!file) return { kind: 'wrong-type', name: list[0].name };
  return file.size >= LARGE_BYTES ? { kind: 'large', file } : { kind: 'ok', file };
}

export type LoadErrorCode = CatalogErrorCode | 'wrong-type';

export interface ErrorCopy {
  title: string;
  body: string;
  /** Opening the same file again might work (transient failure). */
  retry: boolean;
}

export const ERROR_COPY: Record<LoadErrorCode, ErrorCopy> = {
  'wrong-type': {
    title: 'That’s not a Lightroom catalog',
    body: 'Choose the .lrcat file, usually in Pictures › Lightroom. Preview folders and .lrdata files won’t work.',
    retry: false,
  },
  'not-sqlite': {
    title: 'That file isn’t a catalog',
    body: 'It has a catalog’s file extension, but its contents aren’t a database. It may be damaged or renamed.',
    retry: false,
  },
  'not-lightroom': {
    title: 'That’s a database, but not a Lightroom Classic catalog',
    body: 'Choose the .lrcat file Lightroom Classic uses. Lightroom (cloud) libraries aren’t supported.',
    retry: false,
  },
  'read-failed': {
    title: 'The file couldn’t be read',
    body: 'It may have moved, or the browser lost permission to it. Try again, or choose it again.',
    retry: true,
  },
  'too-large': {
    title: 'Not enough memory to open this catalog',
    body: 'The browser couldn’t set aside enough memory. Close other tabs and try again, or use a desktop browser with more memory.',
    retry: true,
  },
  'open-failed': {
    title: 'The catalog couldn’t be opened',
    body: 'If Lightroom is open, close it and try again. The catalog may also be damaged; Lightroom can test it under File › Optimize Catalog.',
    retry: true,
  },
};
