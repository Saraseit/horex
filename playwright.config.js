import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Las referencias de comparación visual se generan desde la demo (scripts/capturar-referencia.cjs --pruebas).
  snapshotPathTemplate: '{testDir}/referencia/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    locale: 'es-MX',
    timezoneId: 'America/Merida',
    deviceScaleFactor: 1,
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 },
  },
  webServer: {
    // Modo de prueba: datos de la demo en memoria y "hoy" fijo (src/configuracion.js); la API se simula.
    command: 'npm run build:prueba && npm run preview:prueba',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
