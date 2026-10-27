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
    // La captura es de la semana pasada: la fecha empieza en su lunes y se conserva entre capturas.
    await expect(page.locator('#fecha')).toHaveValue('2026-10-05');
  });

  test('lista los registros del día sin bloquear', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#fecha').fill('2026-10-10');
    await page.locator('#emp-search').fill('gamboa');
    await page.keyboard.press('Enter');
    await expect(page.locator('.alert.info')).toContainText('Delmer Adolfo Gamboa ya tiene');
    await expect(page.locator('.alert.info')).toContainText('el sáb 10 de oct');
    await expect(page.locator('.alert.info')).toContainText('Puedes agregar otro tipo de hora');
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
    await expect(page.locator('.alert.info', { hasText: 'Domingo' })).toBeVisible();
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
    await page.getByRole('button', { name: 'No', exact: true }).click();
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
    expect(descarga.suggestedFilename()).toMatch(/^Recibo_[A-Za-z_]+_S41_(HE|DC|AL)\.pdf$|^Recibos_Semana41_\d\.pdf$/);
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
    expect(descarga.suggestedFilename()).toMatch(/^Recibos_Semana41_\d+\.pdf$/);
  });
});

test.describe('Comidas por separado', () => {
  test('cada comida con su monto: se cambia en Tarifas y se usa al capturar', async ({ page }) => {
    await page.goto('/catalogos/tarifas');
    await page.getByLabel('Monto Cena', { exact: true }).fill('70');
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
    await expect(encabezados.filter({ hasText: /^(Desayuno|Almuerzo|Cena)/ })).toHaveCount(3);
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

test.describe('Primera versión operativa', () => {
  test('la semana en captura es la pasada: Semana actual abre la 41 y la fecha no pasa de su domingo', async ({ page }) => {
    await page.goto('/semana');
    await expect(page.locator('.view-head h2')).toHaveText('Semana 41');
    await expect(page.locator('.semana-tag')).toHaveText('Semana 41 · 2026');
    await page.goto('/registrar');
    await expect(page.locator('#fecha')).toHaveAttribute('max', '2026-10-11');
  });

  test('el supervisor edita un registro: corrige horas y agrega una comida', async ({ page }) => {
    await page.goto('/semana');
    const fila = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Editar' }) }).first();
    const empleado = await fila.locator('td').nth(2).innerText();
    await fila.getByRole('button', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/registrar\?editar=\d+$/);
    await expect(page.locator('.alert.info').first()).toContainText('Editando el registro');
    await expect(page.locator('#emp-search')).toBeDisabled();
    await page.locator('#num-horas').fill('7');
    await page.locator('.alimento-toggle', { hasText: 'Cena' }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page).toHaveURL(/\/semana\/2026\/41$/);
    await expect(page.locator('.toast')).toContainText(`Registro actualizado: ${empleado}`);
  });

  test('la capturista no ve Editar', async ({ page }) => {
    await conSesion(page, 'CAPTURISTA');
    await page.goto('/semana');
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Recibo', exact: true }).first()).toBeVisible();
  });

  test('registro de sólo comida para alguien que sí genera horas extra', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').fill('chan itza');
    await page.keyboard.press('Enter');
    const guardar = page.getByRole('button', { name: 'Guardar registro' });
    await expect(guardar).toBeDisabled();
    await page.locator('.alimento-toggle', { hasText: 'Almuerzo' }).click();
    await expect(page.locator('.regla-note')).toHaveText('Registro de sólo comida (sin horas extra)');
    await guardar.click();
    await expect(page.locator('.toast')).toHaveText('Guardado: Juan Gabriel Chan · $50');
    await expect(page.locator('.hist-item.new .hist-meta')).toContainText('Solo alimentos');
  });

  test('un tipo de hora se quita volviendo a tocarlo', async ({ page }) => {
    await page.goto('/registrar');
    const normal = page.getByRole('button', { name: /Normal local/ });
    await normal.click();
    await expect(normal).toHaveAttribute('aria-pressed', 'true');
    await normal.click();
    await expect(normal).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Varios tipos de hora el mismo día', () => {
  test('guardar y capturar otro tipo conserva empleado y fecha', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#fecha').fill('2026-10-08');
    await page.locator('#emp-search').fill('chan itza');
    await page.keyboard.press('Enter');
    await page.locator('#num-horas').fill('3');
    await page.getByRole('button', { name: /Muerta especial/ }).click();
    await page.locator('.alimento-toggle', { hasText: 'Desayuno' }).click();
    await page.getByRole('button', { name: 'Guardar y capturar otro tipo' }).click();
    await expect(page.locator('.toast')).toContainText('Guardado: Juan Gabriel Chan');
    // Sigue el mismo empleado y la misma fecha; horas, tipo y comidas quedan limpios.
    await expect(page.locator('#emp-search')).toHaveValue(/Juan Gabriel Chan/);
    await expect(page.locator('#fecha')).toHaveValue('2026-10-08');
    await expect(page.locator('#num-horas')).toHaveValue('');
    await expect(page.locator('#num-horas')).toBeFocused();
    await expect(page.locator('.alert.info')).toContainText('Muerta especial 3 h');
    await page.locator('#num-horas').fill('5');
    await page.getByRole('button', { name: /Especial foránea/ }).click();
    // El desayuno ya se pagó en el otro registro del día.
    await page.locator('.alimento-toggle', { hasText: 'Desayuno' }).click();
    await expect(page.locator('.alert.warn')).toContainText('Desayuno ya está en otro registro de ese día');
    await page.locator('.alimento-toggle', { hasText: 'Desayuno' }).click();
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.locator('#emp-search')).toHaveValue('');
    // Sin recargar: el almacén de prueba vive en memoria.
    await page.getByRole('button', { name: 'Ver semana' }).click();
    const filas = page.locator('tbody tr').filter({ hasText: 'Juan Gabriel Chan' }).filter({ has: page.locator('input[type=checkbox]') });
    await expect(filas.filter({ hasText: 'Muerta especial' })).toHaveCount(1);
    await expect(filas.filter({ hasText: 'Especial foránea' })).toHaveCount(1);
  });
});

test('jornada de más de 16 horas (hasta 24)', async ({ page }) => {
  await page.goto('/registrar');
  await page.locator('#emp-search').fill('chan itza');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Normal local/ }).click();
  const guardar = page.getByRole('button', { name: 'Guardar registro' });
  await page.locator('#num-horas').fill('24.5');
  await expect(guardar).toBeDisabled();
  await page.locator('#num-horas').fill('20');
  await expect(guardar).toBeEnabled();
  await guardar.click();
  await expect(page.locator('.toast')).toHaveText('Guardado: Juan Gabriel Chan · $1,200');
});

test.describe('Autofiltro en los encabezados (como Excel)', () => {
  const tarjeta = (page, titulo) => page.locator('.card').filter({ hasText: titulo });
  const menu = (page) => page.getByRole('dialog', { name: /^Filtrar/ });

  test('filtrar el detalle por empleado con el buscador; el encabezado marca el filtro y se quita', async ({ page }) => {
    await page.goto('/semana/2026/41');
    const detalle = tarjeta(page, 'Registros de la semana');
    const filas = detalle.locator('tbody tr');
    await expect(filas.first()).toBeVisible();
    const todas = await filas.count();
    await detalle.getByRole('button', { name: 'Filtrar Empleado' }).click();
    await menu(page).getByRole('searchbox', { name: 'Buscar valor' }).fill('gamboa');
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    await expect(menu(page)).toHaveCount(0);
    expect(await filas.count()).toBeLessThan(todas);
    for (const texto of await filas.allInnerTexts()) expect(texto).toContain('Delmer');
    await expect(detalle.getByRole('button', { name: 'Filtrar Empleado' })).toHaveClass(/activo/);
    await detalle.getByRole('button', { name: 'Filtrar Empleado' }).click();
    await menu(page).getByRole('button', { name: 'Quitar filtro' }).click();
    await expect(filas).toHaveCount(todas);
  });

  test('desmarcar valores de una columna (tipo) y combinar con otra', async ({ page }) => {
    await page.goto('/semana/2026/41');
    const detalle = tarjeta(page, 'Registros de la semana');
    await detalle.getByRole('button', { name: 'Filtrar Tipo' }).click();
    await menu(page).getByText('Seleccionar todo').click();
    await menu(page).getByText('Muerta', { exact: true }).click();
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    const filas = detalle.locator('tbody tr');
    for (const texto of await filas.allInnerTexts()) expect(texto).toMatch(/Muerta(?! especial)/);
    // El menú de otra columna sólo ofrece los valores que deja el primer filtro.
    await detalle.getByRole('button', { name: 'Filtrar Empleado' }).click();
    const opciones = await menu(page).locator('.menu-filtro-valor:not(.todos)').count();
    expect(opciones).toBeLessThanOrEqual(await filas.count());
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
  });

  test('ordenar desde el menú y totales de la matriz que siguen al filtro', async ({ page }) => {
    await page.goto('/semana/2026/41');
    const matriz = tarjeta(page, 'Horas por empleado y día');
    await matriz.getByRole('button', { name: 'Filtrar Total' }).click();
    await menu(page).getByRole('button', { name: 'Ordenar de mayor a menor' }).click();
    const totales = (await matriz.locator('tbody tr td:last-child').allInnerTexts()).map((t) => Number(t.replace(/[$,]/g, '')));
    expect(totales).toEqual([...totales].sort((a, b) => b - a));
    await expect(matriz.locator('tfoot td').first()).toHaveText('Total semana');
    await matriz.getByRole('button', { name: 'Filtrar Empleado' }).click();
    await menu(page).getByRole('searchbox', { name: 'Buscar valor' }).fill('gamboa');
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    await expect(matriz.locator('tbody tr')).toHaveCount(1);
    await expect(matriz.locator('tfoot td').first()).toHaveText('Total filtrado');
    await expect(matriz.locator('tfoot td').last()).toHaveText(await matriz.locator('tbody tr td').last().innerText());
  });

  test('"Seleccionar todos" marca sólo las filas visibles y filtrar limpia la selección', async ({ page }) => {
    await page.goto('/semana/2026/41');
    const detalle = tarjeta(page, 'Registros de la semana');
    await detalle.locator('tbody tr').first().getByRole('checkbox').check();
    await detalle.getByRole('button', { name: 'Filtrar Empleado' }).click();
    await menu(page).getByRole('searchbox', { name: 'Buscar valor' }).fill('gamboa');
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    await expect(detalle.getByRole('button', { name: /^Recibos/ })).toHaveText('Recibos');
    const visibles = await detalle.locator('tbody tr').count();
    await detalle.getByRole('checkbox', { name: 'Seleccionar todos' }).check();
    await expect(detalle.getByRole('button', { name: /^Recibos/ })).toHaveText(`Recibos (${visibles})`);
  });

  test('clic en el nombre de la columna sigue ordenando', async ({ page }) => {
    await page.goto('/semana/2026/41');
    const matriz = tarjeta(page, 'Horas por empleado y día');
    await matriz.getByRole('button', { name: 'Total', exact: true }).click();
    await expect(matriz.locator('th[aria-sort="descending"]')).toHaveText(/Total/);
  });

  test('Por período: filtrar la lista de empleados por grupo', async ({ page }) => {
    await page.goto('/reportes/periodo');
    const lista = tarjeta(page, 'Empleados del período');
    await expect(lista.locator('tbody tr').first()).toBeVisible();
    await lista.getByRole('button', { name: 'Filtrar Grupo' }).click();
    await menu(page).getByText('Eventual', { exact: true }).click();
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    for (const texto of await lista.locator('tbody tr').allInnerTexts()) expect(texto).toContain('P. Fijo');
  });

  test('Por empleado: filtrar el historial por tipo y el total lo sigue', async ({ page }) => {
    await page.goto('/reportes/empleado/14');
    const historial = tarjeta(page, 'Historial de registros');
    await historial.getByRole('button', { name: 'Filtrar Tipo' }).click();
    await menu(page).getByText('Seleccionar todo').click();
    await menu(page).getByText('Especial foránea', { exact: true }).click();
    await menu(page).getByRole('button', { name: 'Aceptar' }).click();
    for (const texto of await historial.locator('tbody tr').allInnerTexts()) expect(texto).toContain('Especial foránea');
    await expect(historial.locator('tfoot td').first()).toHaveText('Total filtrado');
  });
});

test('la cena del personal eventual tiene su propio monto', async ({ page }) => {
  await page.goto('/catalogos/tarifas');
  await page.getByRole('spinbutton', { name: 'Monto Cena eventual' }).fill('60');
  await page.locator('.card').filter({ hasText: 'Alimentos y excepciones' }).getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.toast')).toContainText('actualizado');
  // Sin recargar: el almacén de prueba vive en memoria.
  await page.getByRole('button', { name: /Registrar HE/ }).click();
  const cena = page.locator('.alimento-toggle', { hasText: 'Cena' });
  await page.locator('#emp-search').fill('silveira');
  await page.keyboard.press('Enter');
  await expect(cena).toContainText('$60');
  await page.locator('#emp-search').fill('gamboa');
  await page.keyboard.press('Enter');
  await expect(cena).toContainText('$50');
});

test.describe('Usuario de solo consulta', () => {
  test('no ve Registrar HE, entra a Semana actual y sólo descarga recibos', async ({ page }) => {
    await comoRol(page, 'CONSULTA');
    await page.goto('/');
    await expect(page).toHaveURL(/\/semana$/);
    await expect(page.getByRole('button', { name: /Registrar HE/ })).toHaveCount(0);
    await expect(page.locator('.user-role')).toHaveText('Consulta');
    await expect(page.getByRole('button', { name: 'Recibo', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar', exact: true })).toHaveCount(0);
    await page.goto('/registrar');
    await expect(page).toHaveURL(/\/semana$/);
  });
});

test.describe('Contrato', () => {
  test('se captura en Registrar HE, aparece en su columna y se filtra; por omisión es 0', async ({ page }) => {
    await page.goto('/registrar');
    await expect(page.locator('#contrato')).toHaveValue('0');
    await page.locator('#fecha').fill('2026-10-08');
    await page.locator('#emp-search').fill('chan itza');
    await page.keyboard.press('Enter');
    await page.locator('#num-horas').fill('2');
    await page.getByRole('button', { name: /Normal local/ }).click();
    await page.locator('#contrato').fill('17106');
    await expect(page.locator('.resumen-row', { hasText: 'Contrato' })).toContainText('17106');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.locator('.toast')).toContainText('Guardado: Juan Gabriel Chan');
    // Después de guardar vuelve a 0 para el siguiente empleado.
    await expect(page.locator('#contrato')).toHaveValue('0');
    // Sin recargar: el almacén de prueba vive en memoria.
    await page.getByRole('button', { name: 'Ver semana' }).click();
    const detalle = page.locator('.card').filter({ hasText: 'Registros de la semana' });
    await detalle.getByRole('button', { name: 'Filtrar Contrato' }).click();
    const menu = page.getByRole('dialog', { name: /^Filtrar/ });
    await menu.getByText('Seleccionar todo').click();
    await menu.getByText('17106', { exact: true }).click();
    await menu.getByRole('button', { name: 'Aceptar' }).click();
    await expect(detalle.locator('tbody tr')).toHaveCount(1);
    await expect(detalle.locator('tbody tr')).toContainText('Juan Gabriel Chan');
    await expect(detalle.locator('tbody tr')).toContainText('17106');
  });

  test('"Guardar y capturar otro tipo" conserva el contrato', async ({ page }) => {
    await page.goto('/registrar');
    await page.locator('#emp-search').fill('chan itza');
    await page.keyboard.press('Enter');
    await page.locator('#num-horas').fill('2');
    await page.getByRole('button', { name: /Normal local/ }).click();
    await page.locator('#contrato').fill('16619');
    await page.getByRole('button', { name: 'Guardar y capturar otro tipo' }).click();
    await expect(page.locator('.toast')).toContainText('Guardado');
    await expect(page.locator('#contrato')).toHaveValue('16619');
  });
});
