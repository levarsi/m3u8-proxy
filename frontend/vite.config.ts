import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/proxy': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/stats': 'http://127.0.0.1:3000',
      '/cache': 'http://127.0.0.1:3000',
      '/logs': 'http://127.0.0.1:3000',
      '/config': 'http://127.0.0.1:3000',
      '/ad-filter': 'http://127.0.0.1:3000',
      '/ts-detector': 'http://127.0.0.1:3000'
    }
  }
});
