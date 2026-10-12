import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // exceljs (~930 kB) sólo se descarga al pedir un .xlsx (import dinámico); no frena la carga inicial.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
});
