import { resolve } from 'node:path';
import { createServer } from 'vite';
import { adminPort, apiPort, playerPort } from '../ports.ts';

const [panel = 'src', ...extra] = process.argv.slice(2);
if ((panel !== 'src' && panel !== 'src-admin') || extra.length > 0) {
  throw new Error('Use npm run dev or npm run dev src-admin.');
}

const server = await createServer({
  configFile: resolve(import.meta.dirname, 'vite.config.ts'),
  root: resolve(import.meta.dirname, panel),
  cacheDir: resolve(import.meta.dirname, '../node_modules/.vite-' + panel),
  server: {
    host: 'localhost',
    port: panel === 'src' ? playerPort : adminPort,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/viewer/': `http://127.0.0.1:${apiPort}`,
    },
  },
});
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
