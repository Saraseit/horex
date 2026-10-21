// Reglas de tarifa. Copia para la vista previa del formulario: la fuente de verdad es la función
// calcular_tarifa de Postgres (Fase 2), que debe pasar las mismas pruebas (reglas.test.js).
import { esDomingo, semanaISO } from './fechas.js';

export const ETIQUETA_SOLO_ALIMENTOS = 'Solo alimentos';

export const esEspecial = (clave) => !!clave && clave.startsWith('ESPECIAL');

/** Clase CSS de .tipo-pill / .hist-dot. null = "Solo alimentos". */
export function claseTipo(clave) {
  if (!clave) return 'sinhe';
  if (clave.includes('MUERTA')) return 'muerta';
  if (clave.includes('ESPECIAL')) return 'especial';
  return '';
}

export function etiquetaTipo(clave, tipos) {
  if (!clave) return ETIQUETA_SOLO_ALIMENTOS;
  return tipos.find((t) => t.clave === clave)?.etiqueta ?? clave;
}

/**
 * Tarifa por hora para un empleado, fecha y tipo.
 * | Situación                         | P. Fijo | Eventual                         |
 * | Normal (local o foránea)          | tipo    | tipo                             |
 * | Especial entre semana (hora 11+)  | tipo    | tipo — POR CONFIRMAR             |
 * | Domingo, Especial                 | tipo    | parametros.tarifa_domingo_eventual |
 * | Muerta                            | tipo    | tipo                             |
 * | Muerta especial                   | tipo    | tipo — POR CONFIRMAR             |
 * Devuelve { tarifa, regla } donde regla identifica la excepción aplicada (o null).
 */
export function calcularTarifa({ empleado, fecha, tipoClave, tipos, parametros }) {
  if (!empleado || !empleado.genera_he || !tipoClave) return { tarifa: 0, regla: null };
  const tipo = tipos.find((t) => t.clave === tipoClave);
  if (!tipo) throw new Error(`Tipo de hora desconocido: ${tipoClave}`);
  const eventual = empleado.grupo === 'Eventual';
  const tarifaTipo = Number(tipo.tarifa);

  if (eventual && esEspecial(tipoClave)) {
    if (esDomingo(fecha)) return { tarifa: Number(parametros.tarifa_domingo_eventual), regla: 'DOMINGO_EVENTUAL' };
    return { tarifa: tarifaTipo, regla: 'ESPECIAL_EVENTUAL_POR_CONFIRMAR' };
  }
  if (eventual && tipoClave === 'MUERTA_ESPECIAL') {
    return { tarifa: tarifaTipo, regla: 'MUERTA_ESPECIAL_EVENTUAL_POR_CONFIRMAR' };
  }
  return { tarifa: tarifaTipo, regla: null };
}

/** Nota bajo el total del formulario (.regla-note). */
export function notaRegla({ tarifa, regla, tipoClave, fecha }) {
  if (regla === 'DOMINGO_EVENTUAL') return `Regla aplicada: domingo, personal eventual → $${tarifa}/hr`;
  if (esEspecial(tipoClave) && !esDomingo(fecha)) {
    const base = 'Especial entre semana: solo para horas a partir de la 11';
    return regla === 'ESPECIAL_EVENTUAL_POR_CONFIRMAR' ? `${base} · tarifa del eventual por confirmar` : base;
  }
  if (regla === 'MUERTA_ESPECIAL_EVENTUAL_POR_CONFIRMAR') return 'Muerta especial del eventual: tarifa por confirmar';
  return '';
}

export const numComidas = (r) => (r.desayuno ? 1 : 0) + (r.almuerzo ? 1 : 0) + (r.cena ? 1 : 0);

/**
 * Las tres comidas, en el orden en que se muestran. `parametro`: su monto en parametros;
 * `cantidad` e `importe`: sus campos en el resultado de sumar() (agregados.js).
 */
export const COMIDAS = [
  { clave: 'desayuno', etiqueta: 'Desayuno', plural: 'Desayunos', parametro: 'monto_desayuno', cantidad: 'desayunos', importe: 'impDesayunos' },
  { clave: 'almuerzo', etiqueta: 'Almuerzo', plural: 'Almuerzos', parametro: 'monto_almuerzo', cantidad: 'almuerzos', importe: 'impAlmuerzos' },
  { clave: 'cena', etiqueta: 'Cena', plural: 'Cenas', parametro: 'monto_cena', cantidad: 'cenas', importe: 'impCenas' },
];

/** Monto vigente de una comida para ese empleado: la cena del personal eventual tiene su propio monto. */
export function montoComida(clave, parametros, empleado) {
  if (clave === 'cena' && empleado?.grupo === 'Eventual' && parametros.monto_cena_eventual != null) {
    return Number(parametros.monto_cena_eventual);
  }
  return Number(parametros[`monto_${clave}`] ?? 0);
}

/** Agrega las columnas calculadas que en Postgres son "generated always as". */
export function completarRegistro(r) {
  const horas = Number(r.horas);
  const tarifa = Number(r.tarifa_aplicada);
  const importe_he = horas * tarifa;
  const montos = Object.fromEntries(COMIDAS.map((c) => [`monto_${c.clave}`, Number(r[`monto_${c.clave}`] ?? 0)]));
  const importes = Object.fromEntries(COMIDAS.map((c) => [`importe_${c.clave}`, r[c.clave] ? montos[`monto_${c.clave}`] : 0]));
  const importe_alimentos = importes.importe_desayuno + importes.importe_almuerzo + importes.importe_cena;
  const { anio, semana } = semanaISO(r.fecha);
  return {
    ...r,
    anio_iso: anio,
    semana,
    horas,
    tarifa_aplicada: tarifa,
    ...montos,
    ...importes,
    importe_he,
    importe_alimentos,
    total: importe_he + importe_alimentos,
  };
}
