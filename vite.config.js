import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    target: 'esnext'
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  }
});
