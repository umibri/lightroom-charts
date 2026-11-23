import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { openCatalog, openDemoCatalog } from '@/lib/dbClient';
import { setOpenCatalog } from '@/state/catalogStore';
import { DEFAULT_RANGE } from '@/catalog/filters.ts';
import type { OpenOutcome, OpenStage } from '@/worker/db.worker';
import { ERROR_COPY, pickCatalog, type LoadErrorCode } from './pick.ts';
import {
  canRemember,
  dropHandles,
  fileFromHandle,
  forgetRecent,
  lastOpenedText,
  loadRecent,
  pickCatalogHandle,
  saveRecent,
  type RecentCatalog,
} from '@/lib/recentCatalog';

type Handle = FileSystemFileHandle | null;

type State =
  | { kind: 'idle' }
  | { kind: 'large'; file: File; handle: Handle }
  | { kind: 'opening'; name: string; stage: OpenStage | 'demo' }
  | { kind: 'error'; code: LoadErrorCode; file: File | null; handle?: Handle; detail?: string };

const STAGES: { key: OpenStage; label: string }[] = [
  { key: 'reading', label: 'Reading the file' },
  { key: 'opening', label: 'Opening the database' },
  { key: 'checking', label: 'Checking it’s a Lightroom catalog' },
];

const mb = (n: number) => `${Math.round(n / (1024 * 1024)).toLocaleString()} MB`;

export default function LoadRoute() {
  const nav = useNavigate();
  const { from } = useSearch({ from: '/load' });
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = state.kind === 'opening';
  // Last successfully opened catalog (Chromium only; see recentCatalog.ts).
  const [recent, setRecent] = useState<RecentCatalog | null>(null);
  const [recentNote, setRecentNote] = useState('');

  useEffect(() => {
    let alive = true;
    void loadRecent().then((r) => alive && setRecent(r));
    return () => {
      alive = false;
    };
  }, []);

  // Dropping a file anywhere in the window would otherwise make the browser
  // navigate to it, losing the app. Handle drops page-wide instead.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      // Handles must be requested now, while the drop's data is still available.
      const handles = dropHandles(e.dataTransfer);
      if (!busy) void choose(e.dataTransfer?.files ?? null, handles);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  });

  function finish(res: OpenOutcome, file: File | null, handle: Handle = null) {
    if (res.ok) {
      // Remember only catalogs that actually opened.
      if (handle) void saveRecent(handle);
      setOpenCatalog(res.value);
      nav({ to: '/stats', search: { range: DEFAULT_RANGE } });
      return;
    }
    setOpenCatalog(null);
    console.error(res.error);
    setState({ kind: 'error', code: res.error.code, file, handle, detail: res.error.message });
  }

  async function open(file: File, handle: Handle = null) {
    setState({ kind: 'opening', name: file.name, stage: 'reading' });
    try {
      const res = await openCatalog(file, (stage) =>
        setState((s) => (s.kind === 'opening' ? { ...s, stage } : s))
      );
      finish(res, file, handle);
    } catch (e) {
      console.error(e);
      setState({ kind: 'error', code: 'open-failed', file, handle });
    }
  }

  async function openDemo() {
    setState({ kind: 'opening', name: 'Demo catalog', stage: 'demo' });
    try {
      finish(await openDemoCatalog(), null);
    } catch (e) {
      console.error(e);
      setState({ kind: 'error', code: 'open-failed', file: null });
    }
  }

  async function choose(
    files: ArrayLike<File> | null,
    handles: Promise<FileSystemFileHandle | null>[] = []
  ) {
    const pick = pickCatalog(files);
    if (input.current) input.current.value = ''; // allow choosing the same file again
    if (pick.kind === 'none') return;
    if (pick.kind === 'wrong-type') {
      setState({ kind: 'error', code: 'wrong-type', file: null, detail: pick.name });
      return;
    }
    // The handle for the file we picked, if the browser gave us one.
    const handle = (await Promise.all(handles)).find((h) => h?.name === pick.file.name) ?? null;
    if (pick.kind === 'large') {
      setState({ kind: 'large', file: pick.file, handle });
      return;
    }
    void open(pick.file, handle);
  }

  /** Use the system picker where it gives us a reusable handle. */
  async function pickWithHandle() {
    try {
      const handle = await pickCatalogHandle();
      if (!handle) return; // cancelled
      await choose([await handle.getFile()], [Promise.resolve(handle)]);
    } catch (e) {
      console.error(e);
      setState({ kind: 'error', code: 'read-failed', file: null });
    }
  }

  async function reopen(r: RecentCatalog) {
    setRecentNote('');
    const res = await fileFromHandle(r.handle);
    if (res.ok) {
      await choose([res.file], [Promise.resolve(r.handle)]);
      return;
    }
    if (res.reason === 'missing') {
      await forgetRecent();
      setRecent(null);
      setRecentNote(`“${r.name}” is no longer there. It may have been moved, renamed or deleted.`);
    } else if (res.reason === 'denied') {
      setRecentNote('The browser didn’t allow reading the file. Choose it again below.');
    } else {
      setRecentNote('That catalog couldn’t be reopened. Choose it again below.');
    }
  }

  async function forget() {
    await forgetRecent();
    setRecent(null);
    setRecentNote('');
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Open a Lightroom catalog</h1>
        <p className="mt-1 text-sm text-muted">
          Your catalog is read inside this browser tab. Nothing is uploaded.
        </p>
      </div>

      {from === 'stats' && state.kind === 'idle' && (
        <p className="rounded-xl border border-info-line bg-info-bg p-3 text-sm">
          No catalog is open. Catalogs stay in this tab’s memory only, so after a reload you need to
          open yours again{recent ? ': use Reopen below.' : '.'}
        </p>
      )}

      {recent && !busy && state.kind !== 'large' && (
        <section
          aria-label="Recent catalog"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <div className="min-w-0">
            <div className="truncate font-medium" title={recent.name}>
              {recent.name}
            </div>
            <div className="text-sm text-muted">
              Last opened {lastOpenedText(recent.savedAt)} · remembered in this browser only
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-fg px-4 py-1.5 font-medium text-bg"
              onClick={() => void reopen(recent)}
            >
              Reopen
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-fg"
              onClick={() => void forget()}
            >
              Forget
            </button>
          </div>
        </section>
      )}

      {recentNote && (
        <p role="status" className="rounded-xl border border-warn-line bg-warn-bg p-3 text-sm">
          {recentNote}
        </p>
      )}

      <label
        className={`block cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          dragging ? 'border-accent bg-info-bg' : 'border-line-strong hover:bg-surface'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        onClick={(e) => {
          // Where supported, use the system picker: it returns a handle we can
          // remember. Also covers Enter/Space on the focused input (a click).
          if (!canRemember() || busy) return;
          e.preventDefault();
          void pickWithHandle();
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".lrcat,.db"
          className="sr-only"
          disabled={busy}
          onChange={(e) => choose(e.target.files)}
        />
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={`mx-auto mb-3 size-8 ${dragging ? 'text-accent' : 'text-muted'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15V4m0 0L8 8m4-4 4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <span className="block font-medium">
          {dragging ? 'Drop to open' : 'Drop your .lrcat here, or choose a file'}
        </span>
        <span className="mt-1 block text-sm text-muted">
          Usually in Pictures › Lightroom. Close Lightroom first so recent changes are included.
        </span>
      </label>

      {state.kind === 'opening' && (
        <div role="status" className="rounded-xl border border-info-line bg-info-bg p-4 text-sm">
          <div className="mb-2 truncate font-medium">Opening {state.name}…</div>
          {state.stage === 'demo' ? (
            <p className="text-muted">Generating sample photos…</p>
          ) : (
            <ol className="space-y-1">
              {STAGES.map((s, i) => {
                const at = STAGES.findIndex((x) => x.key === state.stage);
                const mark = i < at ? '✓' : i === at ? '…' : '';
                return (
                  <li key={s.key} className={i > at ? 'text-muted' : ''}>
                    <span className="inline-block w-4" aria-hidden>
                      {mark}
                    </span>
                    {s.label}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {state.kind === 'large' && (
        <div role="alert" className="rounded-xl border border-warn-line bg-warn-bg p-4 text-sm">
          <div className="font-medium">This catalog is {mb(state.file.size)}</div>
          <p className="mt-1">
            It will be held in memory while you look at it, and opening it briefly needs about twice
            that. That’s fine on most computers; phones may run out of memory.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-fg px-3 py-1.5 text-bg"
              onClick={() => void open(state.file, state.handle)}
            >
              Open anyway
            </button>
            <button
              type="button"
              className="rounded-lg border border-line bg-surface px-3 py-1.5"
              onClick={() => setState({ kind: 'idle' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="rounded-xl border border-danger-line bg-danger-bg p-4 text-sm">
          <div className="font-medium">{ERROR_COPY[state.code].title}</div>
          <p className="mt-1">{ERROR_COPY[state.code].body}</p>
          {state.code === 'wrong-type' && state.detail && (
            <p className="mt-1 text-muted">You chose “{state.detail}”.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {ERROR_COPY[state.code].retry && state.file && (
              <button
                type="button"
                className="rounded-lg bg-fg px-3 py-1.5 text-bg"
                onClick={() => void open(state.file!, state.handle ?? null)}
              >
                Try again
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-line bg-surface px-3 py-1.5"
              onClick={() => (canRemember() ? void pickWithHandle() : input.current?.click())}
            >
              Choose another file
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-4 text-sm">
        <span className="text-muted">No catalog handy?</span>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface disabled:opacity-60"
          onClick={() => void openDemo()}
        >
          Try with sample data
        </button>
      </div>
    </div>
  );
}
