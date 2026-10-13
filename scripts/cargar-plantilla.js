// Reemplaza la plantilla de empleados por la de db/semilla.sql (y crea tipos y parámetros si faltan).
// Uso: node scripts/cargar-plantilla.js --destino produccion --reemplazar
// Sólo se permite mientras no haya registros: los empleados con historial nunca se borran.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bandera, cargarEntorno, conectar, destino } from './comun.js';

cargarEntorno();
const base = destino();
if (!bandera('reemplazar')) {
  console.error('Agrega --reemplazar para confirmar que la plantilla actual se sustituye por la de db/semilla.sql.');
  process.exit(1);
}
const cliente = await conectar(base.url);
try {
  await cliente.query('begin');
  const { rows: [{ n }] } = await cliente.query('select count(*)::int n from registros_horas');
  if (n > 0) throw new Error(`Hay ${n} registros: la plantilla ya no se puede reemplazar (se desactiva desde la app).`);
  const { rowCount } = await cliente.query('delete from empleados');
  await cliente.query(readFileSync(fileURLToPath(new URL('../db/semilla.sql', import.meta.url)), 'utf8'));
  const { rows: [c] } = await cliente.query('select count(*)::int n from empleados');
  await cliente.query('commit');
  console.log(`✓ "${base.nombre}": ${rowCount} empleados anteriores eliminados, ${c.n} cargados de db/semilla.sql`);
} catch (e) {
  await cliente.query('rollback');
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
