// Errores de Postgres → respuestas HTTP con mensaje en español para la interfaz.

export class ErrorHttp extends Error {
  constructor(estado, mensaje, extra = {}) {
    super(mensaje);
    this.estado = estado;
    this.extra = extra;
  }
}

export function aRespuesta(e) {
  if (e instanceof ErrorHttp) return { estado: e.estado, cuerpo: { error: e.message, ...e.extra } };
  switch (e.code) {
    case 'P0001': // raise exception de los triggers: el mensaje ya es para la persona
      return { estado: 400, cuerpo: { error: e.message } };
    case '42501': // RLS o privilegio
      return { estado: 403, cuerpo: { error: 'No tienes permiso para hacer esto.' } };
    case '23505':
      return { estado: 409, cuerpo: { error: 'Ya existe un registro igual.' } };
    case '23514':
    case '22P02':
    case '22003':
    case '23502':
    case '23503':
      return { estado: 400, cuerpo: { error: 'Datos no válidos.' } };
    default:
      console.error(e);
      return { estado: 500, cuerpo: { error: 'Error interno. Intenta de nuevo.' } };
  }
}
