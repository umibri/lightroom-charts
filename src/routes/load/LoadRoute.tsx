import React from 'react';
import { openCatalog } from '@/lib/dbClient';
import type { CatalogErrorCode } from '@/catalog/validate.ts';
import { useNavigate } from '@tanstack/react-router';

const MAX_WARN_BYTES = 500 * 1024 * 1024; // 500MB

const OPEN_ERROR_TEXT: Record<CatalogErrorCode, string> = {
  'not-sqlite': 'This file isn’t a Lightroom catalog (it isn’t a SQLite database).',
  'not-lightroom': 'This is a database, but not a Lightroom Classic catalog.',
  'open-failed': 'The catalog couldn’t be opened. It may be damaged or too large for this browser.',
};

function isAllowed(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.lrcat') || name.endsWith('.db');
}

function Load() {
  const nav = useNavigate();
  const [fileName, setFileName] = React.useState<string>('');
  const [status, setStatus] = React.useState<'idle' | 'warn' | 'init' | 'error'>('idle');
  const [error, setError] = React.useState<string>('');
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  async function handleFiles(files: FileList | null) {
    setError('');
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!isAllowed(f)) {
      setStatus('error');
      setError('Please upload a Lightroom catalog (.lrcat or .db).');
      return;
    }
    setFileName(f.name);

    if (f.size >= MAX_WARN_BYTES) {
      setPendingFile(f);
      setStatus('warn');
      return;
    }
    await proceedInit(f);
  }

  async function proceedInit(f: File) {
    setStatus('init');
    try {
      const res = await openCatalog(f);
      if (res.ok) {
        nav({ to: '/stats' });
        return;
      }
      setStatus('error');
      setError(OPEN_ERROR_TEXT[res.error.code]);
      console.error(res.error);
    } catch (e: unknown) {
      setStatus('error');
      setError(OPEN_ERROR_TEXT['open-failed']);
      console.error(e);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Load Catalog</h1>

      <label className="block border-2 border-dashed border-line-strong rounded-2xl p-6 text-center cursor-pointer hover:bg-surface">
        <input
          type="file"
          accept=".lrcat,.db,application/octet-stream,application/x-sqlite3"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-sm">
          Drag & drop or click to choose a <strong>.lrcat</strong> / <strong>.db</strong>
        </div>
        {fileName && <div className="mt-2 text-xs text-muted">Selected: {fileName}</div>}
      </label>

      <div
        className="mt-4 h-24 rounded-xl border border-line flex items-center justify-center text-sm text-muted"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        Or drop file here
      </div>

      {status === 'warn' && pendingFile && (
        <div className="mt-4 rounded-xl border border-warn-line p-4 bg-warn-bg">
          <div className="font-medium">Large file detected</div>
          <p className="text-sm mt-1">
            This file is {Math.round(pendingFile.size / (1024 * 1024))} MB. Processing may use
            significant memory and take time.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border border-line bg-surface"
              onClick={() => {
                setPendingFile(null);
                setStatus('idle');
              }}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-lg bg-fg text-bg"
              onClick={() => proceedInit(pendingFile)}
            >
              Proceed anyway
            </button>
          </div>
        </div>
      )}

      {status === 'init' && (
        <div className="mt-4 rounded-xl border border-info-line p-4 bg-info-bg">
          Initializing… (loading sql-wasm.wasm and opening catalog)
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-xl border border-danger-line p-4 bg-danger-bg">
          <div className="font-medium">Couldn’t load that file</div>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}

export default Load;
