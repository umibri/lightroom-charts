import React from 'react';
import { initDatabase } from '@lib/dbClient';
import { useNavigate } from '@tanstack/react-router';

const MAX_WARN_BYTES = 500 * 1024 * 1024; // 500MB

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
    try {
      setStatus('init');
      // Read as ArrayBuffer then wrap as Uint8Array
      const ab = await f.arrayBuffer();
      const bytes = new Uint8Array(ab);
      // Transfer ownership (zero-copy)
      await initDatabase(bytes);
      // quick smoke: SELECT 1 already ran in worker.init; continue
      nav({ to: '/stats' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setStatus('error');
      setError('Could not initialize catalog. Please try again.');
      console.error(e);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Load Catalog</h1>

      <label className="block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:neutral-700">
        <input
          type="file"
          accept=".lrcat,.db,application/octet-stream,application/x-sqlite3"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-sm">
          Drag & drop or click to choose a <strong>.lrcat</strong> / <strong>.db</strong>
        </div>
        {fileName && <div className="mt-2 text-xs text-gray-500">Selected: {fileName}</div>}
      </label>

      <div
        className="mt-4 h-24 rounded-xl border flex items-center justify-center text-sm text-gray-500"
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
        <div className="mt-4 rounded-xl border p-4 bg-amber-50">
          <div className="font-medium">Large file detected</div>
          <p className="text-sm mt-1">
            This file is {Math.round(pendingFile.size / (1024 * 1024))} MB. Processing may use
            significant memory and take time.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-200"
              onClick={() => {
                setPendingFile(null);
                setStatus('idle');
              }}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-lg bg-black text-white"
              onClick={() => proceedInit(pendingFile)}
            >
              Proceed anyway
            </button>
          </div>
        </div>
      )}

      {status === 'init' && (
        <div className="mt-4 rounded-xl border p-4 bg-blue-50">
          Initializing… (loading sql-wasm.wasm and opening catalog)
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-xl border p-4 bg-red-50">
          <div className="font-medium">Couldn’t load that file</div>
          <p className="text-sm mt-1">
            {error} Ensure the file is a Lightroom catalog (.lrcat/.db).
          </p>
        </div>
      )}
    </div>
  );
}

export default Load;
