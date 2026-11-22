import { lazy, Suspense } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import ThemeToggle from '@/router/ThemeToggle';
import '@/styles.css';

// Router devtools are dev-only; production builds drop this branch and its chunk.
const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      }))
    )
  : () => null;

export default function Root() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/load" className="font-semibold">
            Lightroom Charts
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/load" className="text-muted hover:text-fg">
              Load
            </Link>
            <Link to="/stats" className="text-muted hover:text-fg">
              Stats
            </Link>
            {import.meta.env.DEV && (
              <a href="#/debug" className="text-muted hover:text-fg">
                Debug
              </a>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <Suspense>
        <RouterDevtools position="bottom-right" />
      </Suspense>
    </div>
  );
}
