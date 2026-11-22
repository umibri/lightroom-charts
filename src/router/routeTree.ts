import {
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from '@tanstack/react-router';
import Root from '@/router/Root';
import LoadRoute from '@/routes/load/LoadRoute';
import { parseStatsSearch } from '@/catalog/filters.ts';
import { getOpenCatalog } from '@/state/catalogStore';

const rootRoute = createRootRoute({
  component: Root,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/load' });
  },
});

const loadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/load',
  // ?from=stats explains why someone landed here instead of on Stats.
  validateSearch: (raw: Record<string, unknown>): { from?: 'stats' } =>
    raw.from === 'stats' ? { from: 'stats' } : {},
  component: LoadRoute,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  validateSearch: parseStatsSearch,
  // The catalog only lives in this page's worker; after a reload or a direct
  // visit there is nothing to show, so send people to Load.
  beforeLoad: () => {
    if (!getOpenCatalog()) throw redirect({ to: '/load', search: { from: 'stats' } });
  },
  // Lazy: the charting library only loads once someone reaches Stats.
  component: lazyRouteComponent(() => import('@/routes/stats/StatsRoute')),
});

// Dev-only schema explorer. The `if` is constant-folded away in production builds,
// so neither the route nor its chunk ships.
const devRoutes: AnyRoute[] = [];
if (import.meta.env.DEV) {
  devRoutes.push(
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/debug',
      component: lazyRouteComponent(() => import('@/routes/debug/SchemaDebug')),
    })
  );
}

export const routeTree = rootRoute.addChildren([indexRoute, loadRoute, statsRoute, ...devRoutes]);
