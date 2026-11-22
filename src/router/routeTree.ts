import {
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from '@tanstack/react-router';
import Root from '@/router/Root';
import LoadRoute from '@/routes/load/LoadRoute';
import StatsRoute from '@/routes/stats/StatsRoute';

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
  component: LoadRoute,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsRoute,
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
