// Aplica las migraciones pendientes de db/migraciones/ en orden, cada una en su transacción.
// Uso: node scripts/migrar.js --destino desarrollo|produccion [--semilla]
//   --semilla  además corre db/semilla.sql (tipos de hora, parámetros y empleados; no duplica).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bandera, cargarEntorno, conectar, destino } from './comun.js';

const CARPETA = fileURLToPath(new URL('../db/migraciones/', import.meta.url));
const SEMILLA = fileURLToPath(new URL('../db/semilla.sql', import.meta.url));

cargarEntorno();
const base = destino();
const cliente = await conectar(base.url);
try {
  await cliente.query(`create table if not exists esquema_migraciones (
    nombre text primary key, aplicada_at timestamptz not null default now())`);
  const { rows } = await cliente.query('select nombre from esquema_migraciones');
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const pendientes = readdirSync(CARPETA).filter((f) => f.endsWith('.sql') && !aplicadas.has(f)).sort();

  for (const archivo of pendientes) {
    await cliente.query('begin');
    try {
      await cliente.query(readFileSync(CARPETA + archivo, 'utf8'));
      await cliente.query('insert into esquema_migraciones (nombre) values ($1)', [archivo]);
      await cliente.query('commit');
      console.log(`✓ ${archivo}`);
    } catch (e) {
      await cliente.query('rollback');
      throw new Error(`${archivo}: ${e.message}`, { cause: e });
    }
  }
  if (!pendientes.length) console.log('Sin migraciones pendientes.');

  // Marca la base: los scripts de datos de prueba sólo corren en 'desarrollo'.
  await cliente.query(
    'insert into entorno (nombre) values ($1) on conflict (unico) do update set nombre = excluded.nombre',
    [base.nombre],
  );

  if (bandera('semilla')) {
    await cliente.query(readFileSync(SEMILLA, 'utf8'));
    const { rows: [c] } = await cliente.query(
      'select (select count(*) from tipos_hora) tipos, (select count(*) from parametros) parametros, (select count(*) from empleados) empleados',
    );
    console.log(`✓ semilla: ${c.tipos} tipos de hora, ${c.parametros} parámetros, ${c.empleados} empleados`);
  }
  console.log(`Base "${base.nombre}" al día.`);
} finally {
  await cliente.end();
}
