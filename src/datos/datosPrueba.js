// Datos de prueba de la demo (docs/referencia/horex-demo.html): mismos empleados, tarifas y registros.
// El generador reproduce el de la demo llamada por llamada (mulberry32, semilla 2026): no cambies el
// orden de las llamadas a R() o los reportes dejarán de coincidir con las capturas de referencia.
// Sólo para desarrollo y pruebas; scripts/semilla-demo.js (Fase 2) lo reutiliza.

const HOY_DEMO = '2026-10-10';

export const EMPLEADOS_PRUEBA = [
  { id: 1, nombre: 'Miguel Armando Cortes Pinto', puesto: 'Chofer cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 2, nombre: 'Cindy Cristina Novelo Villalobos', puesto: 'Auxiliar de almacén', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 3, nombre: 'Jeanine Beatriz Perez Falcon', puesto: 'Encargada de almacén blancos', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 4, nombre: 'Gerardo Jose Itza Poot', puesto: 'Coordinador de Operaciones', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: false, activo: true },
  { id: 5, nombre: 'Yahir Antonio Nah Molina', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 6, nombre: 'Erik Alejandro Tzec Chacon', puesto: 'Especialista de mesas', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 7, nombre: 'Angel Enrique Moo Chale', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 8, nombre: 'Antonio Jimenez Morales', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 9, nombre: 'Isac Ariel Cante Baak', puesto: 'Auxiliar de compras', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 10, nombre: 'Armando Andres Guzman Coba', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 11, nombre: 'Mirian Noemi Dzul Uc', puesto: 'Encargada de nómina', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 12, nombre: 'Luis Mauricio Garrido Marmolejo', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 13, nombre: 'Eric de Jesus Echeverria Cime', puesto: 'Almacenista', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: false, activo: true },
  { id: 14, nombre: 'Delmer Adolfo Gamboa Arjona', puesto: 'Chofer cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 15, nombre: 'Lucas Ivan Salvador Rosario', puesto: 'Chofer cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 16, nombre: 'Carlos Francisco May Cervantes', puesto: 'Chofer cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 17, nombre: 'Aldry Rangel Ake Pech', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 18, nombre: 'Angel Gabriel Heredia Tun', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: false, genera_he: true, activo: true },
  { id: 19, nombre: 'Javier Alejandro Miss Dzul', puesto: 'Operador cargador', grupo: 'Eventual', reclutador: 'EVENTUAL', imss: false, genera_he: true, activo: true },
  { id: 20, nombre: 'Jesus Ricardo Balam Chacon', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 21, nombre: 'Juan Gabriel Chan Itza', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 22, nombre: 'Jorge Andres Garcia de Leon', puesto: 'Operador cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: true },
  { id: 23, nombre: 'Bryan Silveira', puesto: 'Operador cargador', grupo: 'Eventual', reclutador: 'EVENTUAL', imss: false, genera_he: true, activo: true },
  { id: 24, nombre: 'Victor Manuel Garcia', puesto: 'Operador cargador', grupo: 'Eventual', reclutador: 'EVENTUAL', imss: false, genera_he: true, activo: true },
  { id: 25, nombre: 'Juan Carlos Benito', puesto: 'Operador cargador', grupo: 'Eventual', reclutador: 'EVENTUAL', imss: false, genera_he: true, activo: true },
  { id: 26, nombre: 'Raul Ernesto Pech Canul', puesto: 'Operador cargador', grupo: 'Eventual', reclutador: 'EVENTUAL', imss: false, genera_he: true, activo: false },
  { id: 27, nombre: 'Jose Luis Uicab May', puesto: 'Chofer cargador', grupo: 'P. Fijo', reclutador: 'FIJO', imss: true, genera_he: true, activo: false },
];

export const TIPOS_PRUEBA = [
  { clave: 'NORMAL_LOCAL', etiqueta: 'Normal local', tarifa: 60, descripcion: 'Entre semana, hasta la hora 10', orden: 1 },
  { clave: 'NORMAL_FORANEA', etiqueta: 'Normal foránea', tarifa: 60, descripcion: 'Entre semana, servicio fuera de Mérida', orden: 2 },
  { clave: 'ESPECIAL_LOCAL', etiqueta: 'Especial local', tarifa: 80, descripcion: 'Hora 11 en adelante o domingo', orden: 3 },
  { clave: 'ESPECIAL_FORANEA', etiqueta: 'Especial foránea', tarifa: 80, descripcion: 'Hora 11+ o domingo, fuera de Mérida', orden: 4 },
  { clave: 'MUERTA', etiqueta: 'Muerta', tarifa: 30, descripcion: 'Mitad de la tarifa normal', orden: 5 },
  { clave: 'MUERTA_ESPECIAL', etiqueta: 'Muerta especial', tarifa: 40, descripcion: 'Mitad de la tarifa especial', orden: 6 },
];

// La demo paga todas las comidas a $50.
export const PARAMETROS_PRUEBA = {
  monto_desayuno: 50, monto_almuerzo: 50, monto_cena: 50, monto_cena_eventual: 50, tarifa_domingo_eventual: 70,
};

export const USUARIO_PRUEBA = { id: 'usuario-prueba', nombre: 'Mirian Dzul' };

// En la demo las semanas anteriores aparecen como "Cerrada · pagada".
export const SEMANAS_CERRADAS_PRUEBA = [38, 39, 40].map((semana) => ({
  anio_iso: 2026, semana, cerrada_por_nombre: USUARIO_PRUEBA.nombre,
}));

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Registros de las semanas 38–41 de 2026, sin columnas calculadas (ver completarRegistro). */
export function generarRegistrosPrueba() {
  const R = mulberry32(2026);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const weighted = (pairs) => { let r = R() * pairs.reduce((s, p) => s + p[1], 0); for (const [k, w] of pairs) { if ((r -= w) <= 0) return k; } return pairs[0][0]; };
  const tarifaDe = Object.fromEntries(TIPOS_PRUEBA.map((t) => [t.clave, t.tarifa]));
  const porId = (id) => EMPLEADOS_PRUEBA.find((e) => e.id === id);

  const registros = [];
  const agregar = (o) => registros.push({
    id: registros.length + 1, desayuno: false, almuerzo: false, cena: false,
    monto_desayuno: PARAMETROS_PRUEBA.monto_desayuno, monto_almuerzo: PARAMETROS_PRUEBA.monto_almuerzo,
    monto_cena: PARAMETROS_PRUEBA.monto_cena, capturado_por_nombre: USUARIO_PRUEBA.nombre, ...o,
  });

  const oper = EMPLEADOS_PRUEBA.filter((e) => e.activo && e.genera_he && !['Encargada de nómina', 'Auxiliar de compras'].includes(e.puesto));
  for (let d = new Date(2026, 8, 14); aISO(d) <= HOY_DEMO; d.setDate(d.getDate() + 1)) {
    const f = aISO(d);
    if (d.getDay() === 0) {
      if (R() < 0.6) {
        shuffle(oper.slice()).slice(0, 2 + Math.floor(R() * 3)).forEach((emp) => {
          agregar({ empleado_id: emp.id, fecha: f, tipo_clave: 'ESPECIAL_LOCAL', horas: 4 + Math.floor(R() * 5), tarifa_aplicada: emp.grupo === 'Eventual' ? 70 : 80, desayuno: R() < 0.3 });
        });
      }
      continue;
    }
    const n = 4 + Math.floor(R() * 5);
    shuffle(oper.slice()).slice(0, n).forEach((emp) => {
      const tipo = weighted([['NORMAL_LOCAL', 45], ['NORMAL_FORANEA', 20], ['ESPECIAL_LOCAL', 9], ['ESPECIAL_FORANEA', 5], ['MUERTA', 15], ['MUERTA_ESPECIAL', 6]]);
      let horas = tipo.includes('MUERTA') ? 1 + Math.floor(R() * 4) : 1 + Math.floor(R() * 6);
      if (R() < 0.2) horas += 0.5;
      agregar({ empleado_id: emp.id, fecha: f, tipo_clave: tipo, horas, tarifa_aplicada: tarifaDe[tipo], desayuno: R() < 0.22, almuerzo: R() < 0.04, cena: horas >= 4 && R() < 0.45 });
    });
    if (R() < 0.3) {
      const emp = porId(R() < 0.6 ? 4 : 13);
      const des = R() < 0.5;
      agregar({ empleado_id: emp.id, fecha: f, tipo_clave: null, horas: 0, tarifa_aplicada: 0, desayuno: des, cena: !des });
    }
  }
  return registros;
}
