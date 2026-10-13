import { describe, expect, it } from 'vitest';
import { conceptosRecibo, generarRecibos, nombreArchivoRecibos } from './recibo.js';

const registro = {
  id: 7, nombre: 'Delmer Adolfo Gamboa Arjona', fecha: '2026-10-11', anio_iso: 2026, semana: 41,
  tipo_etiqueta: 'Especial foránea', horas: 8, tarifa_aplicada: 80, importe_he: 640,
  desayuno: true, almuerzo: false, cena: true, importe_desayuno: 60, importe_almuerzo: 0, importe_cena: 70,
};

describe('recibo', () => {
  it('lista cada concepto pagado con su importe', () => {
    const { lineas, total } = conceptosRecibo(registro);
    expect(lineas.map((l) => [l.concepto, l.importe])).toEqual([['Horas extra', 640], ['Desayuno', 60], ['Cena', 70]]);
    expect(lineas[0].detalle).toBe('Especial foránea · 8 h × $80.00');
    expect(total).toBe(770);
  });

  it('un registro de sólo alimentos no lleva horas extra', () => {
    const { lineas, total } = conceptosRecibo({ ...registro, horas: 0, importe_he: 0, cena: false });
    expect(lineas.map((l) => l.concepto)).toEqual(['Desayuno']);
    expect(total).toBe(60);
  });

  it('nombre del archivo', () => {
    expect(nombreArchivoRecibos([registro])).toBe('Recibo_Delmer_Adolfo_Gamboa_Arjona_2026-10-11.pdf');
    expect(nombreArchivoRecibos([registro, { ...registro, id: 8 }, { ...registro, id: 9 }])).toBe('Recibos_Semana41_3.pdf');
  });

  it('genera un PDF con dos recibos por hoja', async () => {
    const blob = await generarRecibos([registro, { ...registro, id: 8 }, { ...registro, id: 9 }], { fechaPago: '2026-10-16' });
    const texto = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    expect(texto.startsWith('%PDF')).toBe(true);
    const paginas = texto.split('/Type /Page').length - 1 - (texto.split('/Type /Pages').length - 1);
    expect(paginas).toBe(2);
  }, 30_000);
});
