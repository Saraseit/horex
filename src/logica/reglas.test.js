// Un caso por fila de la tabla de tarifas (docs/PROMPT_HOREX.md §5). calcular_tarifa en Postgres pasa
// exactamente los mismos casos (src/logica/casosTarifa.js → db/pruebas/base.test.js).
import { describe, expect, it } from 'vitest';
import { PARAMETROS_PRUEBA, TIPOS_PRUEBA } from '../datos/datosPrueba.js';
import { CASOS_TARIFA, FECHAS } from './casosTarifa.js';
import { calcularTarifa, claseTipo, completarRegistro, notaRegla } from './reglas.js';

const fijo = { id: 1, grupo: 'P. Fijo', genera_he: true };
const eventual = { id: 2, grupo: 'Eventual', genera_he: true };
const sinHE = { id: 3, grupo: 'P. Fijo', genera_he: false };
const { LUNES, DOMINGO } = FECHAS;

const tarifa = (empleado, fecha, tipoClave, parametros = PARAMETROS_PRUEBA) =>
  calcularTarifa({ empleado, fecha, tipoClave, tipos: TIPOS_PRUEBA, parametros });

describe('calcularTarifa', () => {
  it.each(CASOS_TARIFA)('%s → $%i', (_, grupo, fecha, tipoClave, esperada, regla) => {
    expect(tarifa(grupo === 'Eventual' ? eventual : fijo, fecha, tipoClave)).toEqual({ tarifa: esperada, regla });
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
    const r = completarRegistro({
      fecha: '2026-10-10', horas: 2.5, tarifa_aplicada: 60, desayuno: true, almuerzo: false, cena: true,
      monto_desayuno: 60, monto_almuerzo: 50, monto_cena: 70,
    });
    expect(r).toMatchObject({
      anio_iso: 2026, semana: 41, importe_he: 150,
      importe_desayuno: 60, importe_almuerzo: 0, importe_cena: 70, importe_alimentos: 130, total: 280,
    });
  });
});

describe('claseTipo', () => {
  it.each([[null, 'sinhe'], ['MUERTA_ESPECIAL', 'muerta'], ['ESPECIAL_FORANEA', 'especial'], ['NORMAL_LOCAL', '']])('%s → "%s"', (clave, clase) => {
    expect(claseTipo(clave)).toBe(clase);
  });
});
