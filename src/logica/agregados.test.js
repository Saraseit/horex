import { describe, expect, it } from 'vitest';
import { EMPLEADOS_PRUEBA, generarRegistrosPrueba } from '../datos/datosPrueba.js';
import { barrasDelRango, porDia, porGrupo, porSemana, porTipo, sumar, top } from './agregados.js';
import { semanasEntre } from './fechas.js';
import { completarRegistro } from './reglas.js';

const registros = generarRegistrosPrueba().map(completarRegistro);
const semana41 = registros.filter((r) => r.semana === 41);

describe('datos de prueba = demo', () => {
  // Cifras que muestra la demo (docs/referencia/capturas/periodo-1366-claro.png y semana-1366-claro.png).
  it('periodo 14 sep – 10 oct', () => {
    expect(sumar(registros)).toMatchObject({ registros: 149, horas: 517, he: 30945, alim: 3600, total: 34545, comidas: 72 });
  });

  it('semana 41', () => {
    expect(sumar(semana41)).toMatchObject({ registros: 29, horas: 95, he: 5945, alim: 650, total: 6595, comidas: 13 });
  });

  it('total por semana', () => {
    expect(porSemana(registros).map((s) => [s.semana, s.total])).toEqual([[38, 8665], [39, 10730], [40, 8555], [41, 6595]]);
  });
});

describe('agrupaciones', () => {
  it('fijo vs eventual', () => {
    const g = porGrupo(registros, new Map(EMPLEADOS_PRUEBA.map((e) => [e.id, e])));
    expect(g.fijo.total).toBe(27385);
    expect(g.eventual.total).toBe(7160);
    expect(g.fijo.horas + g.eventual.horas).toBe(517);
  });

  it('por día suma la semana', () => {
    const horasDia = porDia(semana41).map((l) => l.reduce((h, r) => h + r.horas, 0));
    expect(horasDia).toEqual([11, 11.5, 19.5, 18, 16.5, 18.5, 0]);
  });

  it('por tipo incluye "Solo alimentos" (clave null)', () => {
    const solo = porTipo(registros).find((t) => t.clave === null);
    expect(solo).toMatchObject({ registros: 6, horas: 0, total: 300 });
  });

  it('barras por semana: una por semana del rango, también las vacías', () => {
    const semanas = semanasEntre({ anio: 2026, semana: 37 }, { anio: 2026, semana: 41 });
    const { porMes, items } = barrasDelRango(registros, semanas, { anio: 2026, semana: 41 });
    expect(porMes).toBe(false);
    expect(items.map((b) => [b.etiqueta, b.valor, b.actual])).toEqual([
      ['Sem 37', 0, false], ['Sem 38', 8665, false], ['Sem 39', 10730, false], ['Sem 40', 8555, false], ['Sem 41', 6595, true],
    ]);
  });

  it('barras por mes en rangos largos: cada semana entera en el mes de su jueves', () => {
    const semanas = semanasEntre({ anio: 2026, semana: 1 }, { anio: 2026, semana: 41 });
    const { porMes, items } = barrasDelRango(registros, semanas, { anio: 2026, semana: 41 });
    expect(porMes).toBe(true);
    expect(items).toHaveLength(10);
    // Septiembre = semanas 36–39; la 40 (28 sep – 4 oct) cuenta completa en octubre.
    expect(items.find((b) => b.clave === '2026-09').valor).toBe(8665 + 10730);
    expect(items.find((b) => b.clave === '2026-10')).toMatchObject({ valor: 8555 + 6595, actual: true });
  });

  it('top ordena por total a pagar', () => {
    const t = top(registros, 3);
    expect(t.map((x) => x.empleado_id)).toEqual([5, 1, 23]);
    expect(t[0].total).toBe(3300);
  });
});
