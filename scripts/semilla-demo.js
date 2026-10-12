// SÓLO DESARROLLO: carga los datos de la demo (semanas 38–41 de 2026, mulberry32 con semilla 2026) para
// que los reportes se vean como la demo, y crea los usuarios de prueba.
// Uso: node scripts/semilla-demo.js --destino desarrollo [--reiniciar]
//   --reiniciar  borra registros y semanas cerradas antes de cargar (sólo en desarrollo).
// Se niega a correr si la base no está marcada como 'desarrollo' o si su servidor es el de producción.
import { contrasenaLegible, hashContrasena } from '../api/contrasenas.js';
import { EMPLEADOS_PRUEBA, SEMANAS_CERRADAS_PRUEBA, generarRegistrosPrueba } from '../src/datos/datosPrueba.js';
import { bandera, cargarEntorno, conectar, destino, guardarEnEnv, hostDe } from './comun.js';

export const USUARIOS_PRUEBA = [
  { correo: 'supervisor@prueba.horex', nombre: 'Mirian Dzul (prueba)', rol: 'SUPERVISOR', activo: true },
  { correo: 'capturista@prueba.horex', nombre: 'Capturista de prueba', rol: 'CAPTURISTA', activo: true },
  { correo: 'inactivo@prueba.horex', nombre: 'Usuario inactivo', rol: 'CAPTURISTA', activo: false },
];

cargarEntorno();
const base = destino();
if (base.nombre !== 'desarrollo') {
  console.error('semilla-demo sólo corre con --destino desarrollo.');
  process.exit(1);
}
if (process.env.DATABASE_URL_DIRECTA && hostDe(base.url) === hostDe(process.env.DATABASE_URL_DIRECTA)) {
  console.error('DATABASE_URL_DESARROLLO_DIRECTA apunta al mismo servidor que producción. No se carga nada.');
  process.exit(1);
}

let contrasena = process.env.CONTRASENA_PRUEBA;
if (!contrasena) {
  contrasena = contrasenaLegible();
  guardarEnEnv('CONTRASENA_PRUEBA', contrasena);
}

const cliente = await conectar(base.url);
try {
  const { rows: [entorno] } = await cliente.query('select nombre from entorno');
  if (entorno?.nombre !== 'desarrollo') {
    console.error(`La base está marcada como "${entorno?.nombre ?? 'sin marcar'}", no como desarrollo. No se carga nada.`);
    process.exit(1);
  }

  await cliente.query('begin');
  const hash = await hashContrasena(contrasena);
  const ids = {};
  for (const u of USUARIOS_PRUEBA) {
    const { rows: [fila] } = await cliente.query(
      `insert into usuarios (correo, nombre, rol, activo) values ($1, $2, $3, $4)
       on conflict (lower(correo)) do update set nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo
       returning id`,
      [u.correo, u.nombre, u.rol, u.activo],
    );
    ids[u.correo] = fila.id;
    await cliente.query(
      `insert into credenciales (usuario_id, hash) values ($1, $2)
       on conflict (usuario_id) do update set hash = excluded.hash, actualizada_at = now()`,
      [fila.id, hash],
    );
  }

  // Los dos empleados inactivos de la demo (la semilla de producción sólo trae los 25 activos).
  for (const e of EMPLEADOS_PRUEBA.filter((x) => !x.activo)) {
    await cliente.query(
      `insert into empleados (nombre, puesto, grupo, reclutador, imss, genera_he, activo)
       values ($1, $2, $3, $4, $5, $6, false) on conflict (normalizar_nombre(nombre)) do nothing`,
      [e.nombre, e.puesto, e.grupo, e.reclutador, e.imss, e.genera_he],
    );
  }

  if (bandera('reiniciar')) {
    await cliente.query('delete from registros_horas');
    await cliente.query('delete from semanas_cerradas');
  }
  const { rows: [{ n }] } = await cliente.query('select count(*)::int n from registros_horas');
  if (n > 0) {
    await cliente.query('commit');
    console.log(`Ya hay ${n} registros: no se cargan los de la demo (usa --reiniciar para empezar de nuevo).`);
    process.exit(0);
  }

  // Empleados de la demo → id en la base, por nombre.
  const { rows: empleados } = await cliente.query('select id, nombre from empleados');
  const idPorNombre = new Map(empleados.map((e) => [e.nombre, e.id]));
  const nombreDemo = new Map(EMPLEADOS_PRUEBA.map((e) => [e.id, e.nombre]));
  const registros = generarRegistrosPrueba().map((r) => ({
    empleado_id: idPorNombre.get(nombreDemo.get(r.empleado_id)),
    fecha: r.fecha,
    tipo_clave: r.tipo_clave,
    horas: r.horas,
    desayuno: r.desayuno,
    almuerzo: r.almuerzo,
    cena: r.cena,
  }));

  // Se capturan como el supervisor de prueba: el trigger calcula tarifa y alimentos igual que en producción.
  await cliente.query("select set_config('horex.usuario_id', $1, true)", [ids['supervisor@prueba.horex']]);
  await cliente.query(
    `insert into registros_horas (empleado_id, fecha, tipo_clave, horas, desayuno, almuerzo, cena)
     select empleado_id, fecha, tipo_clave, horas, desayuno, almuerzo, cena
     from json_to_recordset($1::json) as x(empleado_id bigint, fecha date, tipo_clave text, horas numeric,
                                          desayuno boolean, almuerzo boolean, cena boolean)`,
    [JSON.stringify(registros)],
  );
  // Como en la demo, las semanas 38–40 quedan cerradas (después de cargar sus registros).
  for (const s of SEMANAS_CERRADAS_PRUEBA) {
    await cliente.query('insert into semanas_cerradas (anio_iso, semana) values ($1, $2)', [s.anio_iso, s.semana]);
  }
  await cliente.query('commit');

  const { rows: [t] } = await cliente.query(
    "select count(*)::int registros, sum(total)::numeric total from v_registros where fecha between '2026-09-14' and '2026-10-10'",
  );
  console.log(`✓ Datos de la demo en "desarrollo": ${t.registros} registros, total $${Number(t.total).toLocaleString('es-MX')} (la demo: 149 y $34,545)`);
  console.log('  Usuarios de prueba: supervisor@prueba.horex, capturista@prueba.horex, inactivo@prueba.horex (contraseña en .env, CONTRASENA_PRUEBA)');
} catch (e) {
  await cliente.query('rollback').catch(() => {});
  throw e;
} finally {
  await cliente.end();
}
