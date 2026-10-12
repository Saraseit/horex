// Un caso por fila de la tabla de tarifas (docs/PROMPT_HOREX.md §5). calcular_tarifa en Postgres
// (Fase 2) debe pasar exactamente los mismos casos.
import { describe, expect, it } from 'vitest';
import { PARAMETROS_PRUEBA, TIPOS_PRUEBA } from '../datos/datosPrueba.js';
import { calcularTarifa, claseTipo, completarRegistro, notaRegla } from './reglas.js';

const fijo = { id: 1, grupo: 'P. Fijo', genera_he: true };
const eventual = { id: 2, grupo: 'Eventual', genera_he: true };
const sinHE = { id: 3, grupo: 'P. Fijo', genera_he: false };
const LUNES = '2026-10-05';
const SABADO = '2026-10-10';
const DOMINGO = '2026-10-11';

const tarifa = (empleado, fecha, tipoClave, parametros = PARAMETROS_PRUEBA) =>
  calcularTarifa({ empleado, fecha, tipoClave, tipos: TIPOS_PRUEBA, parametros });

describe('calcularTarifa', () => {
  it.each([
    ['Normal local, entre semana, P. Fijo', fijo, LUNES, 'NORMAL_LOCAL', 60, null],
    ['Normal foránea, sábado, Eventual', eventual, SABADO, 'NORMAL_FORANEA', 60, null],
    ['Especial entre semana, P. Fijo', fijo, LUNES, 'ESPECIAL_LOCAL', 80, null],
    ['Especial entre semana, Eventual (por confirmar: usa 80)', eventual, LUNES, 'ESPECIAL_FORANEA', 80, 'ESPECIAL_EVENTUAL_POR_CONFIRMAR'],
    ['Domingo especial, P. Fijo', fijo, DOMINGO, 'ESPECIAL_LOCAL', 80, null],
    ['Domingo especial, Eventual', eventual, DOMINGO, 'ESPECIAL_LOCAL', 70, 'DOMINGO_EVENTUAL'],
    ['Muerta, P. Fijo', fijo, LUNES, 'MUERTA', 30, null],
    ['Muerta, Eventual', eventual, LUNES, 'MUERTA', 30, null],
    ['Muerta especial, P. Fijo', fijo, DOMINGO, 'MUERTA_ESPECIAL', 40, null],
    ['Muerta especial, Eventual (por confirmar: usa 40)', eventual, LUNES, 'MUERTA_ESPECIAL', 40, 'MUERTA_ESPECIAL_EVENTUAL_POR_CONFIRMAR'],
  ])('%s → $%i', (_, empleado, fecha, tipoClave, esperada, regla) => {
    expect(tarifa(empleado, fecha, tipoClave)).toEqual({ tarifa: esperada, regla });
  });

  it('el puesto sin horas extra siempre da 0', () => {
    expect(tarifa(sinHE, LUNES, 'ESPECIAL_LOCAL')).toEqual({ tarifa: 0, regla: null });
  });

  it('sin tipo ("Solo alimentos") da 0', () => {
    expect(tarifa(fijo, LUNES, null)).toEqual({ tarifa: 0, regla: null });
  });

  it('el domingo del eventual sale de parametros.tarifa_domingo_eventual', () => {
    expect(tarifa(eventual, DOMINGO, 'ESPECIAL_LOCAL', { ...PARAMETROS_PRUEBA, tarifa_domingo_eventual: 75 }).tarifa).toBe(75);
  });

  it('usa la tarifa vigente del tipo (editable en Tarifas y reglas)', () => {
    const tipos = TIPOS_PRUEBA.map((t) => (t.clave === 'NORMAL_LOCAL' ? { ...t, tarifa: 65 } : t));
    expect(calcularTarifa({ empleado: fijo, fecha: LUNES, tipoClave: 'NORMAL_LOCAL', tipos, parametros: PARAMETROS_PRUEBA }).tarifa).toBe(65);
  });

  it('rechaza un tipo desconocido', () => {
    expect(() => tarifa(fijo, LUNES, 'INVENTADO')).toThrow(/desconocido/);
  });
});

describe('notaRegla', () => {
  it('domingo del eventual', () => {
    expect(notaRegla({ tarifa: 70, regla: 'DOMINGO_EVENTUAL', tipoClave: 'ESPECIAL_LOCAL', fecha: DOMINGO }))
      .toBe('Regla aplicada: domingo, personal eventual → $70/hr');
  });
  it('especial entre semana', () => {
    expect(notaRegla({ tarifa: 80, regla: null, tipoClave: 'ESPECIAL_LOCAL', fecha: LUNES }))
      .toBe('Especial entre semana: solo para horas a partir de la 11');
  });
  it('sin nota para una hora normal', () => {
    expect(notaRegla({ tarifa: 60, regla: null, tipoClave: 'NORMAL_LOCAL', fecha: LUNES })).toBe('');
  });
});

describe('completarRegistro', () => {
  it('calcula importes y semana como las columnas generadas de Postgres', () => {
    const r = completarRegistro({ fecha: '2026-10-10', horas: 2.5, tarifa_aplicada: 60, desayuno: true, almuerzo: false, cena: true, monto_alimento: 50 });
    expect(r).toMatchObject({ anio_iso: 2026, semana: 41, importe_he: 150, importe_alimentos: 100, total: 250 });
  });
});

describe('claseTipo', () => {
  it.each([[null, 'sinhe'], ['MUERTA_ESPECIAL', 'muerta'], ['ESPECIAL_FORANEA', 'especial'], ['NORMAL_LOCAL', '']])('%s → "%s"', (clave, clase) => {
    expect(claseTipo(clave)).toBe(clase);
  });
});
