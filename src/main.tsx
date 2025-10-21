import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppRouterProvider from '@/router/AppRouterProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouterProvider />
  </StrictMode>
);
