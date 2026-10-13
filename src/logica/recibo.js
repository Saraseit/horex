// Recibos para que el empleado firme (pedido del usuario, 13 oct 2026):
// · Uno por empleado, semana y cuenta, con todos sus registros como líneas (fecha, concepto, importe).
// · Tres cuentas que se pagan por separado: horas extra; desayuno y cena; almuerzo. Quien cobra las tres
//   firma tres recibos.
// · Dos recibos por hoja carta cuando caben (hasta 8 líneas); si no, el recibo ocupa la hoja completa.
// agruparRecibos es pura (con pruebas); generarRecibos arma el PDF con jsPDF (se carga al usarse).
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseD, rangoSemanaTexto } from './fechas.js';

export const CUENTAS = [
  { clave: 'HE', titulo: 'Horas extra' },
  { clave: 'DC', titulo: 'Desayuno y cena' },
  { clave: 'AL', titulo: 'Almuerzo' },
];
const ORDEN_CUENTA = Object.fromEntries(CUENTAS.map((c, i) => [c.clave, i]));
const LINEAS_MEDIA_HOJA = 8;

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fechaLinea = (fecha) => format(parseD(fecha), 'EEE dd MMM', { locale: es });

/** Líneas que cada registro aporta a cada cuenta. */
function lineasDe(r) {
  const lineas = [];
  if (Number(r.horas) > 0) {
    lineas.push({
      cuenta: 'HE',
      fecha: r.fecha,
      concepto: `${r.tipo_etiqueta} · ${Number(r.horas).toLocaleString('es-MX')} h × ${pesos.format(r.tarifa_aplicada)}`,
      importe: Number(r.importe_he),
    });
  }
  if (r.desayuno) lineas.push({ cuenta: 'DC', fecha: r.fecha, concepto: 'Desayuno', importe: Number(r.importe_desayuno) });
  if (r.cena) lineas.push({ cuenta: 'DC', fecha: r.fecha, concepto: 'Cena', importe: Number(r.importe_cena) });
  if (r.almuerzo) lineas.push({ cuenta: 'AL', fecha: r.fecha, concepto: 'Almuerzo', importe: Number(r.importe_almuerzo) });
  return lineas.map((l) => ({ ...l, registro: r.id }));
}

/**
 * Agrupa registros en recibos: [{ clave, cuenta, titulo, empleadoId, nombre, anio, semana, lineas, total }].
 * Orden: empleado, semana y cuenta (horas extra, desayuno y cena, almuerzo).
 */
export function agruparRecibos(registros) {
  const recibos = new Map();
  for (const r of registros) {
    for (const l of lineasDe(r)) {
      const clave = `${r.empleado_id}|${r.anio_iso}|${r.semana}|${l.cuenta}`;
      if (!recibos.has(clave)) {
        recibos.set(clave, {
          clave,
          cuenta: l.cuenta,
          titulo: CUENTAS[ORDEN_CUENTA[l.cuenta]].titulo,
          empleadoId: r.empleado_id,
          nombre: r.nombre,
          anio: r.anio_iso,
          semana: r.semana,
          lineas: [],
          total: 0,
        });
      }
      const recibo = recibos.get(clave);
      recibo.lineas.push(l);
      recibo.total += l.importe;
    }
  }
  const lista = [...recibos.values()];
  for (const r of lista) r.lineas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.registro - b.registro);
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.anio - b.anio || a.semana - b.semana
    || ORDEN_CUENTA[a.cuenta] - ORDEN_CUENTA[b.cuenta]);
}

const fechaTexto = (fecha) => format(parseD(fecha), "d 'de' MMMM 'de' yyyy", { locale: es });

/** PDF (Blob) con los recibos de esos registros. fechaPago: 'yyyy-MM-dd'. */
export async function generarRecibos(registros, { fechaPago }) {
  const recibos = agruparRecibos(registros);
  if (!recibos.length) throw new Error('Los registros elegidos no tienen importes que pagar.');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const ANCHO = 215.9;
  const ALTO = 279.4;
  const MITAD = ALTO / 2;
  const IZQ = 18;
  const DER = ANCHO - 18;

  // Acomodo: mitad de hoja si cabe; si no, hoja completa. `ocupado`: 0 vacía, 1 mitad de arriba usada, 2 llena.
  let ocupado = 0;
  let primera = true;
  const lugar = (completo) => {
    if (primera) { primera = false; } else if (completo || ocupado !== 1) { pdf.addPage(); ocupado = 0; }
    if (completo) { ocupado = 2; return { y0: 0, alto: ALTO }; }
    const y0 = ocupado === 1 ? MITAD : 0;
    ocupado = ocupado === 1 ? 2 : 1;
    return { y0, alto: MITAD };
  };

  recibos.forEach((rec) => {
    const completo = rec.lineas.length > LINEAS_MEDIA_HOJA;
    const { y0, alto } = lugar(completo);
    if (!completo && y0 > 0) {
      pdf.setDrawColor(170).setLineWidth(0.2).setLineDashPattern([2, 2], 0).line(8, MITAD, ANCHO - 8, MITAD).setLineDashPattern([], 0);
    }
    let y = y0 + 14;
    pdf.setTextColor(0).setFont('helvetica', 'bold').setFontSize(13).text(`RECIBO DE PAGO · ${rec.titulo.toUpperCase()}`, IZQ, y);
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(110)
      .text(`Folio S${rec.semana}-${rec.anio}-E${rec.empleadoId}-${rec.cuenta}`, DER, y, { align: 'right' });
    pdf.setTextColor(0);

    y += 9;
    const dato = (etiqueta, valor) => {
      pdf.setFont('helvetica', 'bold').setFontSize(9.5).text(etiqueta, IZQ, y);
      pdf.setFont('helvetica', 'normal').text(valor, IZQ + 36, y);
      y += 5.5;
    };
    dato('Empleado:', rec.nombre);
    dato('Fecha de pago:', fechaTexto(fechaPago));
    dato('Semana de trabajo:', `Semana ${rec.semana} (${rangoSemanaTexto(rec.anio, rec.semana)})`);

    y += 1.5;
    pdf.setDrawColor(160).setLineWidth(0.3).line(IZQ, y, DER, y);
    y += 4.5;
    pdf.setFont('helvetica', 'bold').setFontSize(8.5).text('FECHA', IZQ, y).text('CONCEPTO', IZQ + 30, y).text('IMPORTE', DER, y, { align: 'right' });
    y += 2;
    pdf.line(IZQ, y, DER, y);
    pdf.setFont('helvetica', 'normal').setFontSize(9.5);
    for (const l of rec.lineas) {
      y += 5.5;
      pdf.text(fechaLinea(l.fecha), IZQ, y).text(l.concepto, IZQ + 30, y).text(pesos.format(l.importe), DER, y, { align: 'right' });
    }
    y += 2.5;
    pdf.line(IZQ, y, DER, y);
    y += 5.5;
    pdf.setFont('helvetica', 'bold').setFontSize(10).text('TOTAL', IZQ, y).text(pesos.format(rec.total), DER, y, { align: 'right' });
    y += 7;
    pdf.setFont('helvetica', 'normal').setFontSize(9)
      .text(`Recibí la cantidad de ${pesos.format(rec.total)} por concepto de ${rec.titulo.toLowerCase()}.`, IZQ, y);

    const yFirma = y0 + alto - 18;
    const centro = ANCHO / 2;
    pdf.setDrawColor(0).setLineWidth(0.3).line(centro - 45, yFirma, centro + 45, yFirma);
    pdf.setFontSize(9).text('Firma del empleado', centro, yFirma + 4.5, { align: 'center' });
    pdf.setFontSize(8).setTextColor(110).text(rec.nombre, centro, yFirma + 8.5, { align: 'center' });
    pdf.setTextColor(0);
  });

  return pdf.output('blob');
}

/** Recibo_Juan_Perez_S41_HE.pdf (un recibo) o Recibos_Semana41_12.pdf (varios). */
export function nombreArchivoRecibos(registros) {
  const recibos = agruparRecibos(registros);
  if (recibos.length === 1) {
    const r = recibos[0];
    const nombre = r.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');
    return `Recibo_${nombre}_S${r.semana}_${r.cuenta}.pdf`;
  }
  const semanas = [...new Set(recibos.map((r) => r.semana))];
  const texto = semanas.length === 1 ? semanas[0] : `${Math.min(...semanas)}-${Math.max(...semanas)}`;
  return `Recibos_Semana${texto}_${recibos.length}.pdf`;
}
