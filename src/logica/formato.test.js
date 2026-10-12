import { describe, expect, it } from 'vitest';
import { fechaCorta, fechaLarga, fmtHoras, fmtMoneda, fmtTarifa, iniciales, nombreCorto, normalizar } from './formato.js';

describe('formato (mismos textos que la demo)', () => {
  it('moneda MXN sin decimales', () => {
    expect(fmtMoneda(6595)).toBe('$6,595');
    expect(fmtMoneda(0)).toBe('$0');
    expect(fmtMoneda(1140.5)).toBe('$1,141');
  });

  it('horas', () => {
    expect(fmtHoras(95)).toBe('95 h');
    expect(fmtHoras(9.5)).toBe('9.5 h');
    expect(fmtHoras(405.54)).toBe('405.5 h');
  });

  it('tarifa', () => {
    expect(fmtTarifa(60)).toBe('$60');
    expect(fmtTarifa('62.5')).toBe('$62.5');
  });

  it('fechas', () => {
    expect(fechaCorta('2026-10-10')).toBe('10-oct');
    expect(fechaLarga('2026-10-10')).toBe('sáb 10 de oct');
  });

  it('nombres', () => {
    expect(nombreCorto('Yahir Antonio Nah Molina')).toBe('Yahir Antonio Nah');
    expect(nombreCorto('Bryan Silveira')).toBe('Bryan Silveira');
    expect(iniciales('Mirian Dzul')).toBe('MD');
    expect(normalizar('Ángel FALCÓN')).toBe('angel falcon');
  });
});
