// Da de alta (o actualiza) un usuario de Horex con su contraseña. No hay registro público: así se crean.
// Uso: node scripts/crear-usuario.js --destino produccion --correo ana@empresa.mx --nombre "Ana Pérez"
//        --rol SUPERVISOR|CAPTURISTA|CONSULTA [--contrasena "..."] [--desactivar]
// CONSULTA: sólo ve reportes, exporta y descarga recibos (RH, Finanzas).
// Sin --contrasena genera una legible (Horex-XXXX-XXXX-XXXX) y la muestra UNA vez para entregarla.
import { contrasenaLegible, hashContrasena } from '../api/contrasenas.js';
import { argumento, bandera, cargarEntorno, conectar, destino } from './comun.js';

cargarEntorno();
const base = destino();
const correo = argumento('correo')?.trim().toLowerCase();
const nombre = argumento('nombre')?.trim();
const rol = argumento('rol')?.toUpperCase();
if (!correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || !nombre || !['SUPERVISOR', 'CAPTURISTA', 'CONSULTA'].includes(rol)) {
  console.error('Uso: --correo <correo> --nombre "<nombre>" --rol SUPERVISOR|CAPTURISTA|CONSULTA [--contrasena "..."] [--desactivar]');
  process.exit(1);
}
const generada = !argumento('contrasena');
const contrasena = argumento('contrasena') ?? contrasenaLegible();
if (contrasena.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.');
  process.exit(1);
}

const cliente = await conectar(base.url);
try {
  await cliente.query('begin');
  const { rows: [u] } = await cliente.query(
    `insert into usuarios (correo, nombre, rol, activo) values ($1, $2, $3, $4)
     on conflict (lower(correo)) do update set nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo
     returning id, (xmax = 0) as nuevo`,
    [correo, nombre, rol, !bandera('desactivar')],
  );
  await cliente.query(
    `insert into credenciales (usuario_id, hash) values ($1, $2)
     on conflict (usuario_id) do update set hash = excluded.hash, actualizada_at = now()`,
    [u.id, await hashContrasena(contrasena)],
  );
  await cliente.query('commit');
  console.log(`✓ ${u.nuevo ? 'Alta' : 'Actualizado'} en "${base.nombre}": ${nombre} <${correo}> · ${rol}${bandera('desactivar') ? ' · INACTIVO' : ''}`);
  if (generada) console.log(`  Contraseña: ${contrasena}   (entrégala por un medio privado; no se vuelve a mostrar)`);
} catch (e) {
  await cliente.query('rollback');
  throw e;
} finally {
  await cliente.end();
}
