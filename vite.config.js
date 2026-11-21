import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the production build also works when loaded
  // from file:// inside Electron.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
