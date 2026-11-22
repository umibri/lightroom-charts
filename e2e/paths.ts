import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-results/fixtures');

export const FIXTURES = {
  dir,
  demo: path.join(dir, 'demo.lrcat'),
  notDb: path.join(dir, 'renamed.lrcat'),
  otherDb: path.join(dir, 'other.db'),
  text: path.join(dir, 'notes.txt'),
  fileKeyed: path.join(dir, 'file-keyed.lrcat'),
  noExif: path.join(dir, 'no-exif.lrcat'),
  expected: path.join(dir, 'expected.json'),
};

export interface Expected {
  photos: number;
  m12: number;
  m24: number;
  all: number;
}
