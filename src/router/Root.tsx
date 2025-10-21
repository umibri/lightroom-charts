import { Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import '@/styles.css';

export default function Root() {
  return (
    <div className="min-h-full">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold">
            Lightroom Charts (MVP)
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/load" className="text-gray-600 hover:text-gray-900">
              Load
            </Link>
            <Link to="/stats" className="text-gray-600 hover:text-gray-900">
              Stats
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {/* Devtools (optional—remove in prod if you want) */}
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
}
