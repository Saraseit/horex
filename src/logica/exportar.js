// Tablas para nómina (reemplazan la hoja REPORTE) y su conversión a TSV, CSV y .xlsx.
import { sumar } from './agregados.js';
import { siNo } from './formato.js';
import { etiquetaTipo } from './reglas.js';

export const FORMATOS_EXPORTACION = [
  { valor: 'resumen', etiqueta: 'Resumen por empleado' },
  { valor: 'detalle', etiqueta: 'Detalle (formato DATABASE)' },
];

const COLOR_ENCABEZADO = 'FF1E3A6E'; // --brand
const FORMATO_MONEDA = '"$"#,##0.00';

/**
 * Devuelve { encabezados, filas, pie, moneda, numericas, fechas }.
 * `moneda`, `numericas` y `fechas` son índices de columna.
 */
export function datosExport({ registros, empleados, tipos, formato }) {
  const porId = new Map(empleados.map((e) => [e.id, e]));

  if (formato === 'resumen') {
    const ids = [...new Set(registros.map((r) => r.empleado_id))];
    const filas = ids
      .map((id) => porId.get(id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((e) => {
        const s = sumar(registros.filter((r) => r.empleado_id === e.id));
        return [e.nombre, siNo(e.imss), e.grupo, e.reclutador, s.horas, s.he, s.desayunos, s.almuerzos, s.cenas, s.alim, s.total];
      });
    const s = sumar(registros);
    return {
      encabezados: ['Nombre', 'IMSS', 'Grupo', 'Reclutador', 'Horas', 'Importe HE', 'Desayunos', 'Almuerzos', 'Cenas', '$ Alimentos', 'Total'],
      filas,
      pie: ['TOTAL', '', '', '', s.horas, s.he, s.desayunos, s.almuerzos, s.cenas, s.alim, s.total],
      moneda: [5, 9, 10],
      numericas: [4, 5, 6, 7, 8, 9, 10],
      fechas: [],
    };
  }

  const filas = [...registros]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
    .map((r) => {
      const e = porId.get(r.empleado_id);
      return [
        e.nombre, e.puesto, e.grupo, e.reclutador, siNo(e.imss),
        etiquetaTipo(r.tipo_clave, tipos).toUpperCase(), r.semana, r.fecha,
        r.horas, r.tarifa_aplicada, r.importe_he,
        r.desayuno ? r.monto_alimento : 0, r.almuerzo ? r.monto_alimento : 0, r.cena ? r.monto_alimento : 0,
        r.importe_alimentos,
      ];
    });
  return {
    encabezados: ['Nombre', 'Puesto', 'Grupo', 'Reclutador', 'IMSS', 'Tipo hora', 'Semana', 'Fecha', 'Horas', 'Valor hora', 'Importe horas', 'Desayuno', 'Almuerzo', 'Cena', '$ Alimentos'],
    filas,
    pie: null,
    moneda: [9, 10, 11, 12, 13, 14],
    numericas: [6, 8, 9, 10, 11, 12, 13, 14],
    fechas: [7],
  };
}

const todasLasFilas = (d) => [d.encabezados, ...d.filas, ...(d.pie ? [d.pie] : [])];

/** Texto separado por tabuladores, para pegar en Excel o Sheets. */
export const aTSV = (d) => todasLasFilas(d).map((f) => f.join('\t')).join('\n');

function celdaCSV(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 con BOM para que Excel respete los acentos. */
export const aCSV = (d) => '﻿' + todasLasFilas(d).map((f) => f.map(celdaCSV).join(',')).join('\r\n');

export function nombreArchivo({ desde, hasta, formato, extension }) {
  let semanas;
  if (desde.anio !== hasta.anio) semanas = `${desde.anio}-${desde.semana}_a_${hasta.anio}-${hasta.semana}`;
  else if (desde.semana === hasta.semana) semanas = `${desde.semana}`;
  else semanas = `${desde.semana}-${hasta.semana}`;
  return `Horex_Sem${semanas}_${formato}.${extension}`;
}

/** Libro .xlsx (ArrayBuffer): encabezado en negritas sobre --brand, moneda MXN, anchos ajustados y fila de totales. */
export async function aXLSX(d, nombreHoja = 'Horex') {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Horex';
  const hoja = libro.addWorksheet(nombreHoja);

  const convertir = (fila) => fila.map((v, i) => {
    if (d.fechas.includes(i) && typeof v === 'string' && v) {
      const [a, m, dia] = v.split('-').map(Number);
      return new Date(Date.UTC(a, m - 1, dia));
    }
    return v;
  });

  const encabezado = hoja.addRow(d.encabezados);
  encabezado.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
  });
  for (const f of d.filas) hoja.addRow(convertir(f));
  if (d.pie) hoja.addRow(d.pie).eachCell((c) => { c.font = { bold: true }; });

  d.encabezados.forEach((titulo, i) => {
    const col = hoja.getColumn(i + 1);
    if (d.moneda.includes(i)) col.numFmt = FORMATO_MONEDA;
    if (d.fechas.includes(i)) col.numFmt = 'yyyy-mm-dd';
    const largos = todasLasFilas(d).map((f) => String(f[i] ?? '').length + (d.moneda.includes(i) ? 4 : 0));
    col.width = Math.min(60, Math.max(titulo.length, ...largos) + 2);
  });
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  return libro.xlsx.writeBuffer();
}
