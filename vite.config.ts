import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function hotFilePlugin(hotFilePath = path.resolve(process.cwd(), 'public/hot')): Plugin {
  const cleanup = () => {
    try {
      if (fs.existsSync(hotFilePath)) {
        fs.unlinkSync(hotFilePath);
      }
    } catch {
      // ignore cleanup failures on shutdown
    }
  };

  return {
    name: 'inertia-hot-file',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | string | null;
        if (!address || typeof address === 'string') return;

        const protocol = server.config.server.https ? 'https' : 'http';
        const host =
          address.address === '::' || address.address === '0.0.0.0'
            ? '127.0.0.1'
            : address.address;
        const url = `${protocol}://${host}:${address.port}`;

        fs.mkdirSync(path.dirname(hotFilePath), { recursive: true });
        fs.writeFileSync(hotFilePath, url);
      });

      server.httpServer?.once('close', cleanup);
      process.once('SIGINT', () => {
        cleanup();
        process.exit();
      });
      process.once('SIGTERM', () => {
        cleanup();
        process.exit();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), hotFilePlugin()],
  base: command === 'build' ? '/build/' : '/',
  build: {
    outDir: 'public/build',
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: 'resources/js/app.tsx',
    },
  },
  server: {
    cors: true,
    host: '127.0.0.1',
    port: 5173,
  },
}));
