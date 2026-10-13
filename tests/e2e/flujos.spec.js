// Flujos de la Fase 1 sobre los datos de prueba de la demo (hoy = 2026-10-10, semana 41).
import { expect, test } from '@playwright/test';
import { conSesion } from './ayudas.js';

const comoRol = conSesion;

// Por defecto, sesión de supervisor (Mirian). Las pruebas de capturista la reemplazan.
test.beforeEach(({ page }) => conSesion(page, 'SUPERVISOR'));

/** Presiona Tab hasta que el elemento enfocado cumpla la condición (máximo `limite` veces). */
async function tabHasta(page, condicion, limite = 15) {
  for (let i = 0; i < limite; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(condicion)) return;
  }
  throw new Error('No se llegó al elemento con Tab');
}

test.describe('Registrar HE', () => {
  test('captura completa sólo con teclado', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').focus();
    await page.keyboard.type('chan itza');
    await expect(page.locator('.employee-option.hl')).toHaveText(/Juan Gabriel Chan Itza/);
    await page.keyboard.press('Enter');
    await expect(page.locator('#num-horas')).toBeFocused();
    await expect(page.locator('.info-strip')).toContainText('Operador cargador');
    await page.keyboard.type('2.5');
    await tabHasta(page, () => document.activeElement.classList.contains('tipo-btn'));
    await page.keyboard.press('Enter');
    await tabHasta(page, () => document.activeElement.textContent === 'Guardar registro');
    await page.keyboard.press('Enter');

    await expect(page.locator('.toast')).toHaveText('Guardado: Juan Gabriel Chan · $150');
    await expect(page.locator('.hist-item.new .hist-name')).toHaveText('Juan Gabriel Chan');
    await expect(page.locator('#emp-search')).toBeFocused();
    await expect(page.locator('#emp-search')).toHaveValue('');
    await expect(page.locator('#fecha')).toHaveValue('2026-10-10');
  });

  test('avisa del duplicado sin bloquear', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').fill('gamboa');
    await page.keyboard.press('Enter');
    await expect(page.locator('.alert.warn')).toContainText('Delmer Adolfo Gamboa ya tiene un registro el sáb 10 de oct');
    await page.locator('#num-horas').fill('1');
    await page.getByRole('button', { name: /Normal local/ }).click();
    await expect(page.getByRole('button', { name: 'Guardar registro' })).toBeEnabled();
  });

  test('puesto sin horas extra: sólo alimentos', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').fill('echeverria');
    await page.keyboard.press('Enter');
    await expect(page.locator('.alert.amber')).toContainText('Almacenista no genera horas extra');
    await expect(page.locator('#num-horas')).toBeDisabled();
    await expect(page.locator('.tipo-btn').first()).toBeDisabled();
    const guardar = page.getByRole('button', { name: 'Guardar registro' });
    await expect(guardar).toBeDisabled();
    await page.getByRole('button', { name: /Cena/ }).click();
    await expect(guardar).toBeEnabled();
    await guardar.click();
    await expect(page.locator('.toast')).toHaveText('Guardado: Eric de Jesus · $50');
  });

  test('domingo eventual a $70 y semana cerrada rechazada', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').fill('silveira');
    await page.keyboard.press('Enter');
    await page.locator('#fecha').fill('2026-09-27');
    await expect(page.locator('.alert.info')).toContainText('Domingo');
    await expect(page.getByRole('button', { name: /Especial local/ })).toContainText('$70/hr');
    await page.locator('#num-horas').fill('4');
    await page.getByRole('button', { name: /Especial local/ }).click();
    await expect(page.locator('.regla-note')).toHaveText('Regla aplicada: domingo, personal eventual → $70/hr');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.locator('.alert.warn', { hasText: 'La semana 39 está cerrada' })).toBeVisible();
  });
});

test.describe('Semana actual', () => {
  test('el supervisor elimina con confirmación y cierra la semana', async ({ page }) => {
    await comoRol(page, 'SUPERVISOR');
    await page.goto('/semana');
    await expect(page.locator('.kpi').first()).toContainText('29 registros');
    await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.toast')).toHaveText('Registro eliminado');
    await expect(page.locator('.kpi').first()).toContainText('28 registros');

    await page.getByRole('button', { name: 'Cerrar semana' }).click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.view-head .badge')).toHaveText('Cerrada · pagada');
    // El supervisor puede eliminar cualquier registro, también con la semana cerrada.
    await expect(page.getByRole('button', { name: 'Eliminar', exact: true }).first()).toBeVisible();
  });

  test('la capturista ve las acciones deshabilitadas', async ({ page }) => {
    await comoRol(page, 'CAPTURISTA');
    await page.goto('/semana');
    await expect(page.getByRole('button', { name: 'Cerrar semana' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cerrar semana' })).toHaveAttribute('title', 'Solo supervisor');
    await expect(page.getByRole('button', { name: 'Eliminar', exact: true })).toHaveCount(0);
  });

  test('la semana va en la URL y el clic en una fila abre el reporte', async ({ page }) => {
    await page.goto('/semana');
    await page.locator('#sem-select').selectOption('2026-39');
    await expect(page).toHaveURL(/\/semana\/2026\/39$/);
    await expect(page.locator('.view-head h2')).toHaveText('Semana 39');
    await page.locator('tr.clickable').first().click();
    await expect(page).toHaveURL(/\/reportes\/empleado\/\d+$/);
  });
});

test.describe('Borrado masivo', () => {
  test('en Semana: marcar varias casillas y eliminarlas juntas', async ({ page }) => {
    await comoRol(page, 'SUPERVISOR');
    await page.goto('/semana');
    const borrar = page.getByRole('button', { name: /Eliminar seleccionados/ });
    await expect(borrar).toBeDisabled();
    const casillas = page.locator('tbody .casilla');
    for (const i of [0, 1, 2]) await casillas.nth(i).check();
    await expect(borrar).toHaveText('Eliminar seleccionados (3)');
    await borrar.click();
    await expect(page.getByText('¿Eliminar 3 registros?')).toBeVisible();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.toast')).toHaveText('3 registros eliminados');
    await expect(page.locator('.kpi').first()).toContainText('26 registros');
    await expect(borrar).toHaveText('Eliminar seleccionados');
  });

  test('seleccionar todos y cancelar no borra nada', async ({ page }) => {
    await comoRol(page, 'SUPERVISOR');
    await page.goto('/semana');
    await page.getByLabel('Seleccionar todos').check();
    await page.getByRole('button', { name: 'Eliminar seleccionados (29)' }).click();
    await page.getByRole('button', { name: 'No' }).click();
    await expect(page.locator('.kpi').first()).toContainText('29 registros');
    await page.getByLabel('Seleccionar todos').uncheck();
    await expect(page.getByRole('button', { name: /Eliminar seleccionados/ })).toBeDisabled();
  });

  test('el supervisor también elimina en una semana cerrada', async ({ page }) => {
    await comoRol(page, 'SUPERVISOR');
    await page.goto('/semana/2026/40');
    await expect(page.locator('.view-head .badge')).toHaveText('Cerrada · pagada');
    const antes = await page.locator('tbody .casilla').count();
    await page.locator('tbody .casilla').first().check();
    await page.getByRole('button', { name: 'Eliminar seleccionados (1)' }).click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.toast')).toHaveText('Registro eliminado');
    await expect(page.locator('tbody .casilla')).toHaveCount(antes - 1);
  });

  test('la capturista marca registros para recibos pero no puede eliminar', async ({ page }) => {
    await comoRol(page, 'CAPTURISTA');
    await page.goto('/semana');
    await expect(page.locator('.kpi').first()).toContainText('29 registros');
    await page.locator('tbody .casilla').first().check();
    await expect(page.getByRole('button', { name: 'Recibos (1)' })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Eliminar/ })).toHaveCount(0);
  });

  test('en Por empleado el supervisor elimina cualquier registro', async ({ page }) => {
    await comoRol(page, 'SUPERVISOR');
    await page.goto('/reportes/empleado/5');
    await expect(page.locator('.kpi').nth(1)).toContainText('11 registros');
    await page.getByLabel('Seleccionar todos').check();
    await page.getByRole('button', { name: 'Eliminar seleccionados (11)' }).click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.toast')).toHaveText('11 registros eliminados');
  });
});

test('Por período usa semanas completas de lunes a domingo', async ({ page }) => {
  await page.goto('/reportes/periodo');
  await expect(page.locator('.view-head p')).toHaveText('14-sep – 11-oct 2026 · 4 semanas');
  await page.getByRole('button', { name: 'Septiembre' }).click();
  await expect(page).toHaveURL(/desde=2026-36&hasta=2026-39/);
  await expect(page.locator('.view-head p')).toHaveText('31-ago – 27-sep 2026 · 4 semanas');
  await expect(page.locator('.kpi.hero .k-val')).toHaveText('$19,395');
  await page.getByRole('button', { name: 'Octubre' }).click();
  await expect(page.locator('.view-head p')).toHaveText('28-sep – 11-oct 2026 · 2 semanas');
  await page.locator('#per-desde').selectOption('2026-38');
  await expect(page.locator('.view-head p')).toHaveText('14-sep – 11-oct 2026 · 4 semanas');
  await expect(page.locator('#per-desde option')).toHaveText(['Semana 38', 'Semana 39', 'Semana 40', 'Semana 41']);
});

test('a 400 px ninguna vista tiene scroll horizontal en el body', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  for (const ruta of ['/registrar', '/semana', '/reportes/empleado/5', '/reportes/periodo', '/exportar', '/catalogos/empleados', '/catalogos/tarifas']) {
    await page.goto(ruta);
    await page.locator('.view:not([aria-busy])').first().waitFor();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, ruta).toBeLessThanOrEqual(400);
  }
});

test('exportar .csv con BOM y fila TOTAL', async ({ page }) => {
  await page.goto('/exportar?desde=2026-38&hasta=2026-41');
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar .csv' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe('Horex_Sem38-41_resumen.csv');
  const ruta = await descarga.path();
  const texto = (await import('node:fs')).readFileSync(ruta, 'utf8');
  expect(texto.startsWith('﻿')).toBe(true);
  expect(texto.trim().split('\r\n').at(-1)).toMatch(/^TOTAL,,,,517,30945,.*,34545$/);
});

test('cambiar una tarifa no recalcula registros guardados', async ({ page }) => {
  await comoRol(page, 'SUPERVISOR');
  await page.goto('/catalogos/tarifas');
  await page.getByLabel('Tarifa Normal local').fill('65');
  await page.getByRole('button', { name: 'Guardar cambios' }).first().click();
  await expect(page.locator('.toast')).toHaveText('1 tarifa actualizada · aplica a capturas nuevas');

  await page.locator('.sidebar').getByRole('button', { name: /Registrar HE/ }).click();
  await expect(page.getByRole('button', { name: /Normal local/ })).toContainText('$65/hr');
  await page.locator('.sidebar').getByRole('button', { name: /Por período/ }).click();
  await expect(page.locator('.kpi.hero .k-val')).toHaveText('$34,545');
});

test('alta de empleado rechaza nombres duplicados sin importar acentos', async ({ page }) => {
  await comoRol(page, 'SUPERVISOR');
  await page.goto('/catalogos/empleados');
  await page.getByRole('button', { name: '+ Nuevo empleado' }).click();
  await page.locator('#ne-nombre').fill('BRYAN  SILVÉIRA');
  await page.getByRole('button', { name: 'Guardar empleado' }).click();
  await expect(page.locator('.toast')).toHaveText('Ya existe un empleado con ese nombre');
  await page.locator('#ne-nombre').fill('Pedro Prueba Uc');
  await page.locator('#ne-grupo').selectOption('Eventual');
  await page.getByRole('button', { name: 'Guardar empleado' }).click();
  await expect(page.locator('.toast')).toHaveText('Alta: Pedro Prueba Uc');
  await expect(page.locator('.view-head p')).toHaveText('26 activos · 2 inactivos · 5 eventuales');
});

test.describe('Recibos', () => {
  test('un recibo por registro con la fecha de pago elegida', async ({ page }) => {
    await page.goto('/semana');
    await page.getByLabel('Fecha de pago').fill('2026-10-16');
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Recibo', exact: true }).first().click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^Recibo_[A-Za-z_]+_2026-10-10\.pdf$/);
    const texto = (await import('node:fs')).readFileSync(await descarga.path(), 'latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
  });

  test('recibos de varios registros en un solo PDF', async ({ page }) => {
    await page.goto('/semana');
    for (const i of [0, 1, 2]) await page.locator('tbody .casilla').nth(i).check();
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Recibos (3)' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe('Recibos_Semana41_3.pdf');
  });
});

test.describe('Comidas por separado', () => {
  test('cada comida con su monto: se cambia en Tarifas y se usa al capturar', async ({ page }) => {
    await page.goto('/catalogos/tarifas');
    await page.getByLabel('Monto Cena').fill('70');
    await page.getByLabel('Monto Desayuno').fill('60');
    await page.getByRole('button', { name: 'Guardar cambios' }).nth(1).click();
    await expect(page.locator('.toast')).toHaveText('2 montos actualizados · aplica a capturas nuevas');

    await page.locator('.sidebar').getByRole('button', { name: /Registrar HE/ }).click();
    await expect(page.locator('.alimento-toggle', { hasText: 'Cena' })).toContainText('$70');
    await page.locator('#emp-search').fill('echeverria');
    await page.keyboard.press('Enter');
    await page.locator('.alimento-toggle', { hasText: 'Desayuno' }).click();
    await page.locator('.alimento-toggle', { hasText: 'Cena' }).click();
    await expect(page.locator('.resumen-total')).toContainText('$130');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.locator('.toast')).toHaveText('Guardado: Eric de Jesus · $130');
  });

  test('la semana muestra desayunos, almuerzos y cenas con cantidad y monto', async ({ page }) => {
    await page.goto('/semana');
    await expect(page.locator('.kpi').nth(2)).toContainText(/Des\. \d+ · Alm\. \d+ · Cena \d+/);
    const encabezados = page.locator('.tbl').first().locator('thead th');
    await expect(encabezados.filter({ hasText: /^(Desayuno|Almuerzo|Cena)$/ })).toHaveCount(3);
  });
});

test('tarifa manual del supervisor con motivo obligatorio', async ({ page }) => {
  await page.goto('/registrar');
  await page.locator('#emp-search').fill('chan itza');
  await page.keyboard.press('Enter');
  await page.locator('#num-horas').fill('2');
  await page.getByRole('button', { name: /Normal local/ }).click();
  await page.getByRole('button', { name: 'Usar tarifa manual…' }).click();
  await page.getByLabel('Tarifa manual ($/hr)').fill('75');
  const guardar = page.getByRole('button', { name: 'Guardar registro' });
  await expect(guardar).toBeDisabled();
  await page.getByLabel(/Motivo/).fill('Acordado con operaciones');
  await expect(page.locator('.resumen-total')).toContainText('$150');
  await guardar.click();
  await expect(page.locator('.toast')).toHaveText('Guardado: Juan Gabriel Chan · $150');
});
