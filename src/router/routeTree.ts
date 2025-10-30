import { createRootRoute, createRoute } from '@tanstack/react-router';
import Root from '@router/Root';
import LoadRoute from '@/routes/load/LoadRoute';
import StatsRoute from '@/routes/stats/StatsRoute';

// Root layout (header + outlet)
const rootRoute = createRootRoute({
  component: Root,
});

// Pages
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LoadRoute, // default to /load for now
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

// Build the route tree and router
export const routeTree = rootRoute.addChildren([indexRoute, loadRoute, statsRoute]);
