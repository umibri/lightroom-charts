import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from '@/router/routeTree';

// Catalog data never changes underneath us (read-only, local), so results stay
// fresh until a new catalog is opened, which changes every query key.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false },
  },
});

// Hash history keeps deep links working on GitHub Pages, which has no SPA fallback.
const router = createRouter({ routeTree, history: createHashHistory() });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AppRouterProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default AppRouterProvider;
