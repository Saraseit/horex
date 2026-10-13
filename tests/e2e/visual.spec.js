// Compara cada vista de la app contra la demo (referencias en tests/e2e/referencia/, generadas con
// `node scripts/capturar-referencia.cjs --pruebas`), con la tolerancia de playwright.config.js (1 %).
// VISUAL_ESTRICTO=1 exige 0 píxeles distintos: sirve para ver cuánto difiere cada vista.
import { expect, test } from '@playwright/test';
import { conSesion } from './ayudas.js';

const ALTO_BASE = 768;
const CSS_OCULTO = '.toast{display:none!important}.sidebar-footer{visibility:hidden!important}';

const VISTAS = {
  registrar: '/registrar',
  semana: '/semana/2026/41',
  empleado: '/reportes/empleado/5',
  periodo: '/reportes/periodo',
  exportar: '/exportar',
  empleados: '/catalogos/empleados',
  tarifas: '/catalogos/tarifas',
};
const VISTAS_SUPERVISOR = ['semana', 'empleados', 'tarifas'];
const TEMAS = { claro: 'light', oscuro: 'dark' };
const ANCHOS = [1366, 400];

// Vistas que cambian a propósito respecto a la demo (docs/DIFERENCIAS_VISUALES.md): se comparan contra
// una captura aprobada de la app (prefijo "app-"). Si cambian otra vez, revisarlas a ojo y regenerarlas con
// npx playwright test tests/e2e/visual.spec.js --update-snapshots=all -g "<vista> <ancho>px"
const DIFERENCIAS_APROBADAS = [
  'exportar-1366', 'exportar-400', 'periodo-1366', 'periodo-400',
  // Comidas por separado, casillas y recibos (pedido del usuario, 13 oct 2026).
  'semana-1366', 'semana-400', 'semana-1366-supervisor', 'semana-400-supervisor',
  'empleado-1366', 'empleado-400',
  // Montos de comidas editables.
  'tarifas-1366', 'tarifas-400', 'tarifas-1366-supervisor', 'tarifas-400-supervisor',
];

// Inicio de sesión: pantalla nueva (no está en la demo), comparada contra capturas aprobadas.
for (const [nombreTema, tema] of [['claro', 'light'], ['oscuro', 'dark']]) {
  for (const ancho of [1366, 400]) {
    test(`login ${ancho}px ${nombreTema}`, async ({ page }) => {
      await conSesion(page, null);
      await page.emulateMedia({ colorScheme: tema });
      await page.setViewportSize({ width: ancho, height: 768 });
      await page.goto('/registrar');
      await page.getByRole('button', { name: 'Entrar' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#correo').blur();
      await expect(page).toHaveScreenshot(`app-login-${ancho}-${nombreTema}.png`);
    });
  }
}

const OPCIONES = process.env.VISUAL_ESTRICTO ? { maxDiffPixels: 0, maxDiffPixelRatio: undefined } : {};

async function abrir(page, ruta, { ancho, tema, rol }) {
  await conSesion(page, rol);
  await page.emulateMedia({ colorScheme: tema });
  await page.setViewportSize({ width: ancho, height: ALTO_BASE });
  await page.goto(ruta);
  await page.locator('.view:not([aria-busy])').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: CSS_OCULTO });
  // Como en la demo, el scroll está en .content: se agranda el viewport hasta que quepa todo.
  const extra = await page.evaluate(() => {
    const c = document.getElementById('content');
    return c.scrollHeight - c.clientHeight;
  });
  await page.setViewportSize({ width: ancho, height: ALTO_BASE + Math.max(0, extra) });
}

for (const [nombreTema, tema] of Object.entries(TEMAS)) {
  for (const ancho of ANCHOS) {
    for (const [vista, ruta] of Object.entries(VISTAS)) {
      const prefijo = DIFERENCIAS_APROBADAS.includes(`${vista}-${ancho}`) ? 'app-' : '';
      test(`${vista} ${ancho}px ${nombreTema}`, async ({ page }) => {
        await abrir(page, ruta, { ancho, tema, rol: 'CAPTURISTA' });
        await expect(page).toHaveScreenshot(`${prefijo}${vista}-${ancho}-${nombreTema}.png`, OPCIONES);
      });
    }
  }
}

for (const ancho of ANCHOS) {
  for (const vista of VISTAS_SUPERVISOR) {
    const prefijo = DIFERENCIAS_APROBADAS.includes(`${vista}-${ancho}-supervisor`) ? 'app-' : '';
    test(`${vista} ${ancho}px claro supervisor`, async ({ page }) => {
      await abrir(page, VISTAS[vista], { ancho, tema: 'light', rol: 'SUPERVISOR' });
      await expect(page).toHaveScreenshot(`${prefijo}${vista}-${ancho}-claro-supervisor.png`, OPCIONES);
    });
  }
}
