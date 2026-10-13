// Recibos para que el empleado firme: uno por registro, dos por hoja carta (con línea de corte).
// conceptosRecibo es pura (con pruebas); generarRecibos arma el PDF con jsPDF (se carga al usarse).
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseD, rangoSemanaTexto } from './fechas.js';
import { COMIDAS } from './reglas.js';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmtHorasRecibo = (h) => `${Number(h).toLocaleString('es-MX')} h`;

/** Conceptos que se pagan en un registro: [{ concepto, detalle, importe }] y el total. */
export function conceptosRecibo(r) {
  const lineas = [];
  if (Number(r.horas) > 0) {
    lineas.push({
      concepto: 'Horas extra',
      detalle: `${r.tipo_etiqueta} · ${fmtHorasRecibo(r.horas)} × ${pesos.format(r.tarifa_aplicada)}`,
      importe: Number(r.importe_he),
    });
  }
  for (const c of COMIDAS) {
    if (r[c.clave]) lineas.push({ concepto: c.etiqueta, detalle: '', importe: Number(r[`importe_${c.clave}`]) });
  }
  return { lineas, total: lineas.reduce((s, l) => s + l.importe, 0) };
}

const fechaTexto = (fecha) => format(parseD(fecha), "d 'de' MMMM 'de' yyyy", { locale: es });
const diaTexto = (fecha) => format(parseD(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

/** PDF (Blob) con un recibo por registro. fechaPago: 'yyyy-MM-dd'. */
export async function generarRecibos(registros, { fechaPago }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const ANCHO = 215.9;
  const MITAD = 279.4 / 2;
  const IZQ = 18;
  const DER = ANCHO - 18;

  registros.forEach((r, i) => {
    if (i > 0 && i % 2 === 0) pdf.addPage();
    const y0 = (i % 2) * MITAD;
    let y = y0 + 16;

    pdf.setFont('helvetica', 'bold').setFontSize(14).text('RECIBO DE PAGO', IZQ, y);
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110).text(`Folio ${r.id}`, DER, y, { align: 'right' });
    pdf.setTextColor(0);
    y += 5;
    pdf.setFontSize(9).setTextColor(110).text('Horas extra y alimentos', IZQ, y);
    pdf.setTextColor(0);

    y += 10;
    const dato = (etiqueta, valor) => {
      pdf.setFont('helvetica', 'bold').setFontSize(10).text(etiqueta, IZQ, y);
      pdf.setFont('helvetica', 'normal').text(valor, IZQ + 38, y);
      y += 6;
    };
    dato('Empleado:', r.nombre);
    dato('Fecha de pago:', fechaTexto(fechaPago));
    dato('Semana de trabajo:', `Semana ${r.semana} (${rangoSemanaTexto(r.anio_iso, r.semana)})`);
    dato('Día trabajado:', diaTexto(r.fecha));

    // Conceptos
    y += 3;
    pdf.setDrawColor(160).setLineWidth(0.3).line(IZQ, y, DER, y);
    y += 5;
    pdf.setFont('helvetica', 'bold').setFontSize(9).text('CONCEPTO', IZQ, y).text('DETALLE', IZQ + 38, y).text('IMPORTE', DER, y, { align: 'right' });
    y += 2;
    pdf.line(IZQ, y, DER, y);
    const { lineas, total } = conceptosRecibo(r);
    pdf.setFont('helvetica', 'normal').setFontSize(10);
    for (const l of lineas) {
      y += 6;
      pdf.text(l.concepto, IZQ, y).text(l.detalle, IZQ + 38, y).text(pesos.format(l.importe), DER, y, { align: 'right' });
    }
    y += 3;
    pdf.line(IZQ, y, DER, y);
    y += 6;
    pdf.setFont('helvetica', 'bold').text('TOTAL', IZQ, y).text(pesos.format(total), DER, y, { align: 'right' });

    y += 9;
    pdf.setFont('helvetica', 'normal').setFontSize(9)
      .text(`Recibí la cantidad de ${pesos.format(total)} por los conceptos descritos.`, IZQ, y);

    // Firma
    const yFirma = y0 + MITAD - 22;
    const centro = ANCHO / 2;
    pdf.setDrawColor(0).setLineWidth(0.3).line(centro - 45, yFirma, centro + 45, yFirma);
    pdf.setFontSize(9).text('Firma del empleado', centro, yFirma + 5, { align: 'center' });
    pdf.setFontSize(8).setTextColor(110).text(r.nombre, centro, yFirma + 9.5, { align: 'center' });
    pdf.setTextColor(0);

    // Línea de corte entre los dos recibos de la hoja
    if (i % 2 === 0 && i + 1 < registros.length) {
      pdf.setDrawColor(170).setLineDashPattern([2, 2], 0).line(8, MITAD, ANCHO - 8, MITAD).setLineDashPattern([], 0);
    }
  });

  return pdf.output('blob');
}

/** Nombre del archivo: Recibo_Juan_Perez_2026-10-11.pdf o Recibos_Semana41_12.pdf */
export function nombreArchivoRecibos(registros) {
  if (registros.length === 1) {
    const r = registros[0];
    const nombre = r.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');
    return `Recibo_${nombre}_${r.fecha}.pdf`;
  }
  const semanas = [...new Set(registros.map((r) => r.semana))];
  return `Recibos_Semana${semanas.length === 1 ? semanas[0] : `${Math.min(...semanas)}-${Math.max(...semanas)}`}_${registros.length}.pdf`;
}
