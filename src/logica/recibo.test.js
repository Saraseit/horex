import { describe, expect, it } from 'vitest';
import { agruparRecibos, generarRecibos, nombreArchivoRecibos } from './recibo.js';

const base = { empleado_id: 19, nombre: 'Delmer Adolfo Gamboa Arjona', anio_iso: 2026, semana: 41, desayuno: false, almuerzo: false, cena: false, importe_desayuno: 0, importe_almuerzo: 0, importe_cena: 0 };
const he = (id, fecha, horas, tarifa, extra = {}) => ({
  ...base, id, fecha, tipo_etiqueta: 'Normal local', horas, tarifa_aplicada: tarifa, importe_he: horas * tarifa, ...extra,
});
const registros = [
  he(3, '2026-10-07', 0.5, 60),
  he(1, '2026-10-05', 2, 60, { desayuno: true, importe_desayuno: 60 }),
  he(2, '2026-10-06', 1, 60, { cena: true, importe_cena: 70, almuerzo: true, importe_almuerzo: 50 }),
];
const otro = { ...he(9, '2026-10-05', 1, 60), empleado_id: 1, nombre: 'Adolfo Sulub Garcia' };

describe('agruparRecibos', () => {
  it('un recibo por empleado y cuenta: horas extra; desayuno y cena; almuerzo', () => {
    const recibos = agruparRecibos(registros);
    expect(recibos.map((r) => [r.cuenta, r.lineas.length, r.total])).toEqual([['HE', 3, 210], ['DC', 2, 130], ['AL', 1, 50]]);
  });

  it('las líneas van por fecha y llevan su importe', () => {
    const [horas, comidas] = agruparRecibos(registros);
    expect(horas.lineas.map((l) => [l.fecha, l.importe])).toEqual([['2026-10-05', 120], ['2026-10-06', 60], ['2026-10-07', 30]]);
    expect(horas.lineas[0].concepto).toBe('Normal local · 2 h × $60.00');
    expect(comidas.lineas.map((l) => `${l.fecha} ${l.concepto}`)).toEqual(['2026-10-05 Desayuno', '2026-10-06 Cena']);
  });

  it('varios empleados: ordenados por nombre', () => {
    const recibos = agruparRecibos([...registros, otro]);
    expect(recibos.map((r) => `${r.nombre.split(' ')[0]}-${r.cuenta}`)).toEqual(['Adolfo-HE', 'Delmer-HE', 'Delmer-DC', 'Delmer-AL']);
  });

  it('un registro de sólo alimentos no genera recibo de horas extra', () => {
    const soloComida = { ...base, id: 5, fecha: '2026-10-05', tipo_etiqueta: 'Solo alimentos', horas: 0, importe_he: 0, cena: true, importe_cena: 70 };
    expect(agruparRecibos([soloComida]).map((r) => r.cuenta)).toEqual(['DC']);
  });
});

describe('archivo de recibos', () => {
  it('nombre del archivo', () => {
    expect(nombreArchivoRecibos([registros[0]])).toBe('Recibo_Delmer_Adolfo_Gamboa_Arjona_S41_HE.pdf');
    expect(nombreArchivoRecibos(registros)).toBe('Recibos_Semana41_3.pdf');
  });

  it('dos recibos por hoja; uno largo ocupa la hoja completa', async () => {
    const paginas = async (regs) => {
      const blob = await generarRecibos(regs, { fechaPago: '2026-10-16' });
      const texto = new TextDecoder('latin1').decode(await blob.arrayBuffer());
      expect(texto.startsWith('%PDF')).toBe(true);
      return texto.split('/Type /Page').length - 1 - (texto.split('/Type /Pages').length - 1);
    };
    expect(await paginas(registros)).toBe(2); // 3 recibos: 2 en la primera hoja, 1 en la segunda
    const largo = Array.from({ length: 10 }, (_, i) => he(100 + i, `2026-10-0${(i % 7) + 5}`.replace('-01', '-1'), 1, 60));
    expect(await paginas([...largo, otro])).toBe(2); // 10 líneas: hoja completa; Adolfo en la siguiente
  }, 30_000);
});
