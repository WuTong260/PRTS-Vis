import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';

export default defineConfig({
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    open: false,
  },
});
