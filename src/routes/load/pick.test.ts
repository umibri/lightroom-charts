import { describe, expect, it } from 'vitest';
import { ERROR_COPY, LARGE_BYTES, pickCatalog } from './pick.ts';

// Node 24 has File; size comes from a fake to avoid allocating 500 MB.
const file = (name: string, size = 10) => {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('pickCatalog', () => {
  it('does nothing when no file was chosen', () => {
    expect(pickCatalog(null)).toEqual({ kind: 'none' });
    expect(pickCatalog([])).toEqual({ kind: 'none' });
  });

  it('accepts .lrcat and .db, case-insensitively', () => {
    expect(pickCatalog([file('Lightroom Catalog.LRCAT')]).kind).toBe('ok');
    expect(pickCatalog([file('catalog.db')]).kind).toBe('ok');
  });

  it('rejects other extensions, naming the file', () => {
    expect(pickCatalog([file('IMG_0001.jpg')])).toEqual({
      kind: 'wrong-type',
      name: 'IMG_0001.jpg',
    });
    expect(pickCatalog([file('Catalog Previews.lrdata')]).kind).toBe('wrong-type');
  });

  it('prefers the .lrcat when several files are dropped together', () => {
    const r = pickCatalog([file('Catalog.lrcat-wal'), file('other.db'), file('Catalog.lrcat')]);
    expect(r.kind === 'ok' && r.file.name).toBe('Catalog.lrcat');
  });

  it('warns at the large-file threshold', () => {
    expect(pickCatalog([file('a.lrcat', LARGE_BYTES - 1)]).kind).toBe('ok');
    expect(pickCatalog([file('a.lrcat', LARGE_BYTES)]).kind).toBe('large');
  });
});

describe('error copy', () => {
  it('offers retry only for failures that might be transient', () => {
    const retryable = Object.entries(ERROR_COPY)
      .filter(([, c]) => c.retry)
      .map(([k]) => k)
      .sort();
    expect(retryable).toEqual(['open-failed', 'read-failed', 'too-large']);
  });
});
