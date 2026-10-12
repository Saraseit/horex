// Flujos de la Fase 1 sobre los datos de prueba de la demo (hoy = 2026-10-10, semana 41).
import { expect, test } from '@playwright/test';

const comoRol = (page, rol) => page.addInitScript((r) => localStorage.setItem('horex:rol-prueba', r), rol);

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
    await page.getByRole('button', { name: 'Eliminar' }).first().click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.toast')).toHaveText('Registro eliminado');
    await expect(page.locator('.kpi').first()).toContainText('28 registros');

    await page.getByRole('button', { name: 'Cerrar semana' }).click();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.locator('.view-head .badge')).toHaveText('Cerrada · pagada');
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('la capturista ve las acciones deshabilitadas', async ({ page }) => {
    await comoRol(page, 'CAPTURISTA');
    await page.goto('/semana');
    await expect(page.getByRole('button', { name: 'Cerrar semana' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cerrar semana' })).toHaveAttribute('title', 'Solo supervisor');
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
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
