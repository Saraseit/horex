import { describe, expect, it } from 'vitest';
import {
  desplazarSemana, diasDeSemana, esDomingo, hoyMerida, indiceDia, lunesDeSemana, mesAnterior, nombreMes,
  rangoSemanaTexto, semanaISO, semanasEntre,
} from './fechas.js';

describe('semana ISO (igual que ISOWEEKNUM de Excel)', () => {
  it.each([
    ['2026-10-10', 2026, 41],
    ['2026-10-05', 2026, 41],
    ['2026-10-11', 2026, 41],
    ['2026-09-14', 2026, 38],
    ['2026-12-31', 2026, 53],
    ['2027-01-01', 2026, 53],
    ['2027-01-04', 2027, 1],
  ])('%s → %i-S%i', (fecha, anio, semana) => {
    expect(semanaISO(fecha)).toEqual({ anio, semana });
  });

  it('lunes y días de la semana', () => {
    expect(lunesDeSemana(2026, 41)).toBe('2026-10-05');
    expect(lunesDeSemana(2027, 1)).toBe('2027-01-04');
    expect(diasDeSemana(2026, 41)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('se desplaza entre años', () => {
    expect(desplazarSemana({ anio: 2026, semana: 53 }, 1)).toEqual({ anio: 2027, semana: 1 });
    expect(desplazarSemana({ anio: 2026, semana: 41 }, -3)).toEqual({ anio: 2026, semana: 38 });
    expect(semanasEntre({ anio: 2026, semana: 38 }, { anio: 2026, semana: 41 })).toHaveLength(4);
  });

  it('rango de la semana como en la demo', () => {
    expect(rangoSemanaTexto(2026, 41)).toBe('5 oct – 11 oct 2026');
  });
});

describe('hoyMerida', () => {
  it('usa la hora de Mérida (UTC−6), no la del equipo', () => {
    expect(hoyMerida(new Date('2026-10-11T05:30:00Z'))).toBe('2026-10-10');
    expect(hoyMerida(new Date('2026-10-11T06:30:00Z'))).toBe('2026-10-11');
  });
});

describe('días', () => {
  it('domingo e índice (0 = lunes)', () => {
    expect(esDomingo('2026-10-11')).toBe(true);
    expect(esDomingo('2026-10-10')).toBe(false);
    expect(indiceDia('2026-10-05')).toBe(0);
    expect(indiceDia('2026-10-11')).toBe(6);
  });

  it('meses', () => {
    expect(mesAnterior('2026-10-10')).toBe('2026-09-01');
    expect(nombreMes('2026-09-01')).toBe('Septiembre');
  });
});
