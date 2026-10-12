// Aplicación Express de la API. Sin estado propio: todo vive en Postgres (RLS + triggers).
import express from 'express';
import { verificarContrasena } from './contrasenas.js';
import { ErrorHttp, aRespuesta } from './errores.js';
import { crearSesiones } from './sesion.js';

const INTENTOS_MAXIMOS = 10;
const VENTANA_MS = 15 * 60 * 1000;
// Hash de una contraseña cualquiera: si el correo no existe se verifica contra éste, para tardar lo mismo.
const HASH_SEÑUELO = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

const envolver = (fn) => (req, res, next) => fn(req, res, next).catch(next);

export function crearApp({ bd, secreto, produccion = false }) {
  const sesiones = crearSesiones({ secreto, produccion });
  const fallos = new Map(); // correo → { n, desde }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // Healthcheck de Railway (sin base, para no depender de que Neon esté despierto).
  app.get('/salud', (req, res) => res.type('text').send('ok'));

  const api = express.Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Las peticiones que cambian algo deben ser JSON: un formulario de otro sitio no puede mandarlo.
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Se esperaba JSON.' });
    }
    next();
  });
  api.use(express.json({ limit: '200kb' }));

  /** Exige sesión válida y usuario activo; deja req.usuario = { id, nombre, rol }. */
  const requiereSesion = envolver(async (req, res, next) => {
    const id = await sesiones.leer(req);
    if (!id) throw new ErrorHttp(401, 'Inicia sesión para continuar.');
    const usuario = await bd.transaccion(id, async (c) => (
      await c.query('select id, nombre, rol from usuarios where id = usuario_actual()')
    ).rows[0]);
    if (!usuario) {
      sesiones.quitar(res);
      throw new ErrorHttp(401, 'Tu usuario está desactivado o ya no existe. Habla con el supervisor.', { motivo: 'inactivo' });
    }
    req.usuario = usuario;
    next();
  });

  // Iniciar sesión.
  api.post('/sesion', envolver(async (req, res) => {
    const correo = String(req.body?.correo ?? '').trim().toLowerCase();
    const contrasena = String(req.body?.contrasena ?? '');
    if (!correo || !contrasena) throw new ErrorHttp(400, 'Escribe tu correo y tu contraseña.');

    const intento = fallos.get(correo);
    if (intento && Date.now() - intento.desde < VENTANA_MS && intento.n >= INTENTOS_MAXIMOS) {
      throw new ErrorHttp(429, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.');
    }

    const fila = await bd.transaccion(null, async (c) => (
      await c.query('select id, nombre, rol, activo, hash from credenciales_para_login($1)', [correo])
    ).rows[0]);
    const valida = await verificarContrasena(contrasena, fila?.hash ?? HASH_SEÑUELO);
    if (!fila || !valida) {
      const previo = intento && Date.now() - intento.desde < VENTANA_MS ? intento : { n: 0, desde: Date.now() };
      fallos.set(correo, { n: previo.n + 1, desde: previo.desde });
      throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
    }
    fallos.delete(correo);
    if (!fila.activo) {
      throw new ErrorHttp(403, 'Tu usuario está desactivado. Habla con el supervisor.', { motivo: 'inactivo' });
    }
    sesiones.poner(res, await sesiones.firmar(fila.id));
    res.json({ usuario: { id: fila.id, nombre: fila.nombre, rol: fila.rol } });
  }));

  // Sesión actual.
  api.get('/sesion', requiereSesion, (req, res) => res.json({ usuario: req.usuario }));

  // Cerrar sesión.
  api.delete('/sesion', (req, res) => {
    sesiones.quitar(res);
    res.status(204).end();
  });

  api.use((req, res) => res.status(404).json({ error: 'No existe esa ruta de la API.' }));
  app.use('/api', api);

  // Errores: JSON con mensaje en español.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });
    const { estado, cuerpo } = aRespuesta(err);
    res.status(estado).json(cuerpo);
  });

  return app;
}
