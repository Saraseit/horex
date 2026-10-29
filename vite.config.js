import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En desarrollo /api va a la API local (cd api && npm run dev).
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173, strictPort: true },
  // exceljs (~930 kB) sólo se descarga al pedir un .xlsx (import dinámico); no frena la carga inicial.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['src/**/*.test.js', 'db/**/*.test.js', 'api/**/*.test.js'],
    environment: 'node',
    // Las pruebas de base y API van contra Neon: la primera conexión despierta la base.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Base y API escriben en la misma rama de desarrollo: en paralelo, una ve los registros temporales de la otra.
    fileParallelism: false,
  },
});
