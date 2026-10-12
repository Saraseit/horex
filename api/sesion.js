// Sesión: JWT HS256 en una cookie httpOnly, SameSite=Strict. La web y la API comparten origen
// (horex-web reenvía /api), así que la cookie es de primera parte y no hace falta CORS.
import { SignJWT, jwtVerify } from 'jose';

export const NOMBRE_COOKIE = 'horex_sesion';
const DURACION_S = 7 * 24 * 3600; // 7 días; el usuario se revisa (activo) en cada petición

export function crearSesiones({ secreto, produccion }) {
  const clave = new TextEncoder().encode(secreto);

  const cookie = (valor, maxAge) => [
    `${NOMBRE_COOKIE}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    produccion && 'Secure',
  ].filter(Boolean).join('; ');

  return {
    firmar: (usuarioId) => new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(usuarioId)
      .setIssuer('horex')
      .setIssuedAt()
      .setExpirationTime(`${DURACION_S}s`)
      .sign(clave),

    /** id del usuario de la cookie, o null si no hay o no es válida. */
    async leer(req) {
      const token = leerCookie(req.headers.cookie, NOMBRE_COOKIE);
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, clave, { issuer: 'horex', algorithms: ['HS256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    },

    poner: (res, token) => res.setHeader('Set-Cookie', cookie(token, DURACION_S)),
    quitar: (res) => res.setHeader('Set-Cookie', cookie('', 0)),
  };
}

function leerCookie(cabecera = '', nombre) {
  for (const parte of cabecera.split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) {
      try { return decodeURIComponent(valor.join('=')); } catch { return null; }
    }
  }
  return null;
}
