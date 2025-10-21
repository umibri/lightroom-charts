import { createRootRoute, createRoute } from '@tanstack/react-router';
import Root from '@router/Root';
import Load from '@pages/Load';
import Stats from '@pages/Stats';

// Root layout (header + outlet)
const rootRoute = createRootRoute({
  component: Root,
});

// Pages
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Load, // default to /load for now
});

const loadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/load',
  component: Load,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: Stats,
});

// Build the route tree and router
export const routeTree = rootRoute.addChildren([indexRoute, loadRoute, statsRoute]);
