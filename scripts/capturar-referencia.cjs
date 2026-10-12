// Toma las capturas de referencia de la demo (docs/referencia/horex-demo.html).
// Uso: node scripts/capturar-referencia.cjs [--pruebas]   (requiere @playwright/test 1.64 y su Chromium)
// Salida: docs/referencia/capturas/<vista>-<ancho>-<tema>[-supervisor].png
// Con --pruebas escribe en tests/e2e/referencia/ (base de toHaveScreenshot) y oculta el pie de la barra
// lateral, que en la app cambia a propósito (selector de rol → Cerrar sesión).
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('@playwright/test');

const RAIZ = path.resolve(__dirname, '..');
const DEMO = pathToFileURL(path.join(RAIZ, 'docs/referencia/horex-demo.html')).href;
const PRUEBAS = process.argv.includes('--pruebas');
const SALIDA = path.join(RAIZ, PRUEBAS ? 'tests/e2e/referencia' : 'docs/referencia/capturas');
const CSS_OCULTO = '.toast{display:none!important}' + (PRUEBAS ? '.sidebar-footer{visibility:hidden!important}' : '');

const VISTAS = ['registrar', 'semana', 'empleado', 'periodo', 'exportar', 'empleados', 'tarifas'];
const VISTAS_SUPERVISOR = ['semana', 'empleados', 'tarifas'];
const ANCHOS = [1366, 400];
const TEMAS = { claro: 'light', oscuro: 'dark' };
const ALTO_BASE = 768;

async function capturarVista(pagina, vista, archivo) {
  await pagina.click(`.sidebar [data-action="nav"][data-view="${vista}"]`);
  // El clic de Playwright desplaza la barra lateral horizontal (≤ 860 px) hasta el botón; se regresa al
  // inicio, que es como queda al abrir una ruta directamente.
  await pagina.evaluate(() => {
    document.getElementById('content').scrollTop = 0;
    document.querySelector('.sidebar').scrollLeft = 0;
  });
  // La demo no hace scroll en body sino en .content: se agranda el viewport hasta que quepa todo.
  const ancho = pagina.viewportSize().width;
  const extra = await pagina.evaluate(() => {
    const c = document.getElementById('content');
    return c.scrollHeight - c.clientHeight;
  });
  await pagina.setViewportSize({ width: ancho, height: ALTO_BASE + Math.max(0, extra) });
  await pagina.screenshot({ path: path.join(SALIDA, archivo), animations: 'disabled' });
  await pagina.setViewportSize({ width: ancho, height: ALTO_BASE });
}

async function nuevaPagina(navegador, ancho, tema) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: ALTO_BASE },
    deviceScaleFactor: 1,
    colorScheme: tema,
    locale: 'es-MX',
    timezoneId: 'America/Merida',
  });
  const pagina = await contexto.newPage();
  await pagina.goto(DEMO, { waitUntil: 'networkidle' });
  await pagina.evaluate(() => document.fonts.ready);
  // El toast no forma parte de la referencia.
  await pagina.addStyleTag({ content: CSS_OCULTO });
  return { contexto, pagina };
}

(async () => {
  require('node:fs').mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const hechas = [];
  for (const [nombreTema, tema] of Object.entries(TEMAS)) {
    for (const ancho of ANCHOS) {
      const { contexto, pagina } = await nuevaPagina(navegador, ancho, tema);
      for (const vista of VISTAS) {
        const archivo = `${vista}-${ancho}-${nombreTema}.png`;
        await capturarVista(pagina, vista, archivo);
        hechas.push(archivo);
      }
      if (nombreTema === 'claro') {
        // Clic programático: con --pruebas el pie de la barra lateral está oculto.
        await pagina.evaluate(() => document.querySelector('.role-seg [data-rol="SUPERVISOR"]').click());
        for (const vista of VISTAS_SUPERVISOR) {
          const archivo = `${vista}-${ancho}-${nombreTema}-supervisor.png`;
          await capturarVista(pagina, vista, archivo);
          hechas.push(archivo);
        }
      }
      await contexto.close();
    }
  }
  await navegador.close();
  console.log(`${hechas.length} capturas en ${path.relative(RAIZ, SALIDA)}`);
})();
