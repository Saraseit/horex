// Arranque de horex-api. En Railway: DATABASE_URL (rol horex_api, con pooler), JWT_SECRETO, PORT, NODE_ENV.
// En local (npm run dev): sin DATABASE_URL usa DATABASE_URL_DESARROLLO_API del .env (rama desarrollo).
import { crearApp } from './app.js';
import { crearBd } from './bd.js';
import { urlBase, validarConfiguracion } from './configuracion.js';

const problema = validarConfiguracion(process.env);
if (problema) {
  console.error(`horex-api no arranca: ${problema}`);
  process.exit(1);
}

const bd = crearBd(urlBase(process.env));
const app = crearApp({ bd, secreto: process.env.JWT_SECRETO, produccion: process.env.NODE_ENV === 'production' });
const puerto = Number(process.env.PORT) || 8080;
// '::' escucha en IPv6 e IPv4: la red privada de Railway usa IPv6.
const servidor = app.listen(puerto, '::', () => console.log(`horex-api escuchando en :${puerto}`));

process.on('SIGTERM', () => servidor.close(() => bd.cerrar().finally(() => process.exit(0))));
