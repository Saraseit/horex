// Da LOGIN y una contraseña nueva al rol horex_api y guarda su cadena de conexión (con pooler) en .env.
// Uso: node scripts/crear-rol-api.js --destino desarrollo|produccion
// Producción → DATABASE_URL_API (la que va en Railway como DATABASE_URL de horex-api).
// Desarrollo → DATABASE_URL_DESARROLLO_API. La contraseña nunca se imprime.
import { randomBytes } from 'node:crypto';
import { cargarEntorno, conectar, destino, guardarEnEnv } from './comun.js';

cargarEntorno();
const base = destino();
const contrasena = randomBytes(24).toString('base64url'); // sólo letras, números, - y _: segura dentro del SQL
const cliente = await conectar(base.url);
try {
  await cliente.query(`alter role horex_api with login nobypassrls password '${contrasena}'`);
} finally {
  await cliente.end();
}

const url = new URL(base.url);
url.username = 'horex_api';
url.password = contrasena;
const [endpoint, ...resto] = url.hostname.split('.');
if (!endpoint.endsWith('-pooler')) url.hostname = [`${endpoint}-pooler`, ...resto].join('.');
const variable = base.nombre === 'produccion' ? 'DATABASE_URL_API' : 'DATABASE_URL_DESARROLLO_API';
guardarEnEnv(variable, url.toString());
console.log(`✓ horex_api con contraseña nueva en "${base.nombre}"; cadena guardada en .env como ${variable}`);
