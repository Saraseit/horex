// Sumas y agrupaciones sobre registros ya completos (con importe_he, importe_alimentos y total).
import { claveSemana, compararSemanas, esDomingo, indiceDia } from './fechas.js';

const vacio = () => ({
  registros: 0, horas: 0, he: 0, alim: 0, total: 0, comidas: 0, desayunos: 0, almuerzos: 0, cenas: 0,
});

export function sumar(regs) {
  return regs.reduce((a, r) => {
    a.registros += 1;
    a.horas += Number(r.horas);
    a.he += Number(r.importe_he);
    a.alim += Number(r.importe_alimentos);
    a.total += Number(r.total);
    a.desayunos += r.desayuno ? 1 : 0;
    a.almuerzos += r.almuerzo ? 1 : 0;
    a.cenas += r.cena ? 1 : 0;
    a.comidas = a.desayunos + a.almuerzos + a.cenas;
    return a;
  }, vacio());
}

/** Map clave → registros, conservando el orden de aparición. */
export function agrupar(regs, claveDe) {
  const m = new Map();
  for (const r of regs) {
    const k = claveDe(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/** Siete listas de registros, de lunes a domingo. */
export function porDia(regs) {
  const dias = Array.from({ length: 7 }, () => []);
  for (const r of regs) dias[indiceDia(r.fecha)].push(r);
  return dias;
}

/** [{ empleado_id, registros: [...], ...sumas }] */
export function porEmpleado(regs) {
  return [...agrupar(regs, (r) => r.empleado_id)].map(([empleado_id, lista]) => ({
    empleado_id, lista, ...sumar(lista),
  }));
}

/** [{ clave, ...sumas }] por tipo; clave null = Solo alimentos. */
export function porTipo(regs) {
  return [...agrupar(regs, (r) => r.tipo_clave ?? null)].map(([clave, lista]) => ({ clave, ...sumar(lista) }));
}

/** [{ anio, semana, ...sumas }] ordenado por semana. */
export function porSemana(regs) {
  return [...agrupar(regs, (r) => claveSemana({ anio: r.anio_iso, semana: r.semana }))]
    .map(([, lista]) => ({ anio: lista[0].anio_iso, semana: lista[0].semana, ...sumar(lista) }))
    .sort(compararSemanas);
}

export function porGrupo(regs, empleadosPorId) {
  const eventual = (r) => empleadosPorId.get(r.empleado_id)?.grupo === 'Eventual';
  return { fijo: sumar(regs.filter((r) => !eventual(r))), eventual: sumar(regs.filter(eventual)) };
}

export const domingos = (regs) => regs.filter((r) => esDomingo(r.fecha));

/** Los `n` empleados con más total a pagar. */
export const top = (regs, n = 10) => porEmpleado(regs).sort((a, b) => b.total - a.total).slice(0, n);
