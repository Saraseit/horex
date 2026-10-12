import { describe, expect, it } from 'vitest';
import { EMPLEADOS_PRUEBA, TIPOS_PRUEBA, generarRegistrosPrueba } from '../datos/datosPrueba.js';
import { sumar } from './agregados.js';
import { aCSV, aTSV, aXLSX, datosExport, nombreArchivo } from './exportar.js';
import { completarRegistro } from './reglas.js';

const registros = generarRegistrosPrueba().map(completarRegistro).filter((r) => r.semana === 41);
const exportar = (formato) => datosExport({ registros, empleados: EMPLEADOS_PRUEBA, tipos: TIPOS_PRUEBA, formato });

describe('datosExport', () => {
  it('resumen: una fila por empleado y TOTAL igual a la semana', () => {
    const d = exportar('resumen');
    expect(d.encabezados).toEqual(['Nombre', 'IMSS', 'Grupo', 'Reclutador', 'Horas', 'Importe HE', 'Desayunos', 'Almuerzos', 'Cenas', '$ Alimentos', 'Total']);
    expect(d.filas).toHaveLength(14);
    expect(d.filas[0][0]).toBe('Aldry Rangel Ake Pech');
    const s = sumar(registros);
    expect(d.pie).toEqual(['TOTAL', '', '', '', s.horas, s.he, s.desayunos, s.almuerzos, s.cenas, s.alim, s.total]);
    expect(d.pie.at(-1)).toBe(6595);
  });

  it('detalle: formato de la hoja DATABASE, una fila por registro', () => {
    const d = exportar('detalle');
    expect(d.encabezados).toHaveLength(15);
    expect(d.filas).toHaveLength(29);
    expect(d.filas[0].slice(5, 8)).toEqual(['NORMAL FORÁNEA', 41, '2026-10-05']);
    const totalHE = d.filas.reduce((a, f) => a + f[10], 0);
    expect(totalHE).toBe(5945);
  });
});

describe('formatos de archivo', () => {
  it('TSV para pegar en Excel', () => {
    const lineas = aTSV(exportar('resumen')).split('\n');
    expect(lineas).toHaveLength(16);
    expect(lineas[0].split('\t')[0]).toBe('Nombre');
  });

  it('CSV con BOM y comillas cuando hace falta', () => {
    const csv = aCSV({ encabezados: ['Nombre', 'Nota'], filas: [['Pérez, Juan', 'dijo "sí"']], pie: null });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Pérez, Juan","dijo ""sí"""');
  });

  it('nombre del archivo', () => {
    expect(nombreArchivo({ desde: { anio: 2026, semana: 38 }, hasta: { anio: 2026, semana: 41 }, formato: 'resumen', extension: 'xlsx' }))
      .toBe('Horex_Sem38-41_resumen.xlsx');
    expect(nombreArchivo({ desde: { anio: 2026, semana: 41 }, hasta: { anio: 2026, semana: 41 }, formato: 'detalle', extension: 'csv' }))
      .toBe('Horex_Sem41_detalle.csv');
  });

  it('xlsx con encabezado y totales', async () => {
    const buffer = await aXLSX(exportar('resumen'));
    const { default: ExcelJS } = await import('exceljs');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    const hoja = libro.worksheets[0];
    expect(hoja.getRow(1).getCell(1).value).toBe('Nombre');
    expect(hoja.getRow(1).getCell(1).font.bold).toBe(true);
    expect(hoja.getRow(hoja.rowCount).getCell(11).value).toBe(6595);
    expect(hoja.getColumn(11).numFmt).toContain('$');
  }, 30_000); // la primera carga de exceljs en Node es lenta
});
