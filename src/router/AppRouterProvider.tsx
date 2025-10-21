import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from '@router/router';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AppRouterProvider() {
  return <RouterProvider router={router} />;
}

export default AppRouterProvider;
