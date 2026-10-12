// Cliente de la API (/api, mismo origen: la cookie de sesión viaja sola).

export class ErrorApi extends Error {
  constructor(mensaje, estado, motivo) {
    super(mensaje);
    this.estado = estado;
    this.motivo = motivo;
  }
}

export async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 0);
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error ?? `Error ${respuesta.status} del servidor.`, respuesta.status, datos?.motivo);
  }
  return datos;
}
