// Casos de la tabla de tarifas (prompt §5). Los usan reglas.test.js (JS) y db/pruebas/base.test.js (SQL):
// las dos implementaciones deben dar exactamente lo mismo.
export const FECHAS = { LUNES: '2026-10-05', SABADO: '2026-10-10', DOMINGO: '2026-10-11' };

// [situación, grupo, fecha, tipo, tarifa esperada, regla (sólo JS)]
export const CASOS_TARIFA = [
  ['Normal local, entre semana, P. Fijo', 'P. Fijo', FECHAS.LUNES, 'NORMAL_LOCAL', 60, null],
  ['Normal foránea, sábado, Eventual', 'Eventual', FECHAS.SABADO, 'NORMAL_FORANEA', 60, null],
  ['Especial entre semana, P. Fijo', 'P. Fijo', FECHAS.LUNES, 'ESPECIAL_LOCAL', 80, null],
  ['Especial entre semana, Eventual (por confirmar: usa 80)', 'Eventual', FECHAS.LUNES, 'ESPECIAL_FORANEA', 80, 'ESPECIAL_EVENTUAL_POR_CONFIRMAR'],
  ['Domingo especial, P. Fijo', 'P. Fijo', FECHAS.DOMINGO, 'ESPECIAL_LOCAL', 80, null],
  ['Domingo especial, Eventual', 'Eventual', FECHAS.DOMINGO, 'ESPECIAL_LOCAL', 70, 'DOMINGO_EVENTUAL'],
  ['Muerta, P. Fijo', 'P. Fijo', FECHAS.LUNES, 'MUERTA', 30, null],
  ['Muerta, Eventual', 'Eventual', FECHAS.LUNES, 'MUERTA', 30, null],
  ['Muerta especial, P. Fijo', 'P. Fijo', FECHAS.DOMINGO, 'MUERTA_ESPECIAL', 40, null],
  ['Muerta especial, Eventual (por confirmar: usa 40)', 'Eventual', FECHAS.LUNES, 'MUERTA_ESPECIAL', 40, 'MUERTA_ESPECIAL_EVENTUAL_POR_CONFIRMAR'],
];
