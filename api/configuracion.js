/** URL de la base: DATABASE_URL (Railway) o, en local, DATABASE_URL_DESARROLLO_API (rama desarrollo). */
export const urlBase = (entorno) => entorno.DATABASE_URL ?? entorno.DATABASE_URL_DESARROLLO_API;

/** Devuelve el problema de configuración que impide arrancar, o null. */
export function validarConfiguracion(entorno) {
  const url = urlBase(entorno);
  const secreto = entorno.JWT_SECRETO;
  if (!url) return 'Falta DATABASE_URL.';
  let usuario;
  try { usuario = new URL(url).username; } catch { return 'DATABASE_URL no es una cadena de conexión válida.'; }
  // El dueño de la base se salta RLS: la API nunca debe conectarse con él.
  if (usuario !== 'horex_api') return 'DATABASE_URL debe usar el rol horex_api (scripts/crear-rol-api.js), no el dueño de la base.';
  if (!secreto || secreto.length < 32) return 'JWT_SECRETO debe tener al menos 32 caracteres.';
  return null;
}
