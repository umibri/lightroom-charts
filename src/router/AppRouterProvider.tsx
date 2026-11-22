import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '@/router/routeTree';

// Hash history keeps deep links working on GitHub Pages, which has no SPA fallback.
const router = createRouter({ routeTree, history: createHashHistory() });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AppRouterProvider() {
  return <RouterProvider router={router} />;
}

export default AppRouterProvider;
