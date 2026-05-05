import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';

function electronStarter() {
  return {
    name: 'electron-starter',
    configureServer(server) {
      server.httpServer.once('listening', () => {
        spawn('npx', ['electron', '.'], {
          stdio: 'inherit',
          shell: true,
        });
      });
    },
  };
}

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
  plugins: [electronStarter()],
});
