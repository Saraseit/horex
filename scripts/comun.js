// Utilidades de los scripts de base de datos: leer .env, argumentos y conexión según --destino.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const RUTA_ENV = fileURLToPath(new URL('../.env', import.meta.url));

export function cargarEntorno() {
  try {
    process.loadEnvFile(RUTA_ENV);
  } catch {
    // Sin .env: se usan las variables del sistema.
  }
}

export function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const bandera = (nombre) => process.argv.includes(`--${nombre}`);

// Conexión directa (sin pooler) con el dueño de la base: para migraciones y scripts.
const VARIABLES = {
  produccion: 'DATABASE_URL_DIRECTA',
  desarrollo: 'DATABASE_URL_DESARROLLO_DIRECTA',
};

export function destino() {
  const nombre = argumento('destino');
  if (!VARIABLES[nombre]) {
    console.error('Indica la base: --destino desarrollo  o  --destino produccion');
    process.exit(1);
  }
  const url = process.env[VARIABLES[nombre]];
  if (!url) {
    console.error(`Falta ${VARIABLES[nombre]} en .env`);
    process.exit(1);
  }
  return { nombre, url };
}

export const hostDe = (url) => new URL(url).hostname.replace('-pooler', '');

export async function conectar(url) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  return cliente;
}

/** Escribe (o reemplaza) una variable en .env sin mostrar su valor. */
export function guardarEnEnv(clave, valor) {
  let texto = '';
  try { texto = readFileSync(RUTA_ENV, 'utf8'); } catch { /* .env nuevo */ }
  const linea = `${clave}=${valor}`;
  const patron = new RegExp(`^${clave}=.*$`, 'm');
  texto = patron.test(texto) ? texto.replace(patron, linea) : `${texto.replace(/\n?$/, '\n')}${linea}\n`;
  writeFileSync(RUTA_ENV, texto);
}
