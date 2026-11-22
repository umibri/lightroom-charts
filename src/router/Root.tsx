import { lazy, Suspense } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import ThemeToggle from '@/router/ThemeToggle';
import { DEFAULT_RANGE } from '@/catalog/filters.ts';
import '@/styles.css';

// Router devtools are dev-only; production builds drop this branch and its chunk.
const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      }))
    )
  : () => null;

const navLink = 'text-muted hover:text-fg';
const activeNav = { className: 'text-fg font-medium' };

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-6 shrink-0 sm:size-7" aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-chart" />
      <rect x="7" y="16" width="4" height="9" rx="1.5" fill="#fff" />
      <rect x="14" y="10" width="4" height="15" rx="1.5" fill="#fff" />
      <rect x="21" y="6" width="4" height="19" rx="1.5" fill="#fff" />
    </svg>
  );
}

export default function Root() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/load"
            className="flex items-center gap-2 font-semibold whitespace-nowrap sm:text-lg"
          >
            <Logo />
            Lightroom Charts
          </Link>
          <nav className="flex items-center gap-3 text-sm sm:gap-5 sm:text-base">
            <Link to="/load" className={navLink} activeProps={activeNav}>
              Load
            </Link>
            <Link
              to="/stats"
              search={{ range: DEFAULT_RANGE }}
              className={navLink}
              activeProps={activeNav}
            >
              Stats
            </Link>
            {import.meta.env.DEV && (
              <a href="#/debug" className={`${navLink} hidden sm:inline`}>
                Debug
              </a>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted sm:text-sm">
          <span>Runs entirely in your browser. Your catalog is never uploaded.</span>
          <a
            href="https://github.com/umibri/lightroom-charts"
            className="underline-offset-2 hover:text-fg hover:underline"
          >
            Source on GitHub
          </a>
        </div>
      </footer>

      <Suspense>
        <RouterDevtools position="bottom-right" />
      </Suspense>
    </div>
  );
}
