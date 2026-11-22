import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  optimizeDeps: {
    // sql.js is only imported from the worker, so Vite would otherwise discover it
    // lazily on first load, re-optimize, and full-reload the page — wiping the
    // catalog that was just opened in the worker.
    include: ['sql.js'],
  },
  worker: {
    format: 'es',
  },
  build: {
    // The lazily loaded Stats chunk is ~505 kB, almost all of it ECharts
    // (already tree-shaken to bar charts). Warn only if it grows past that.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
