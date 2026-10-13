// Fuente de datos real: la API (/api). Misma forma que almacenPrueba.js, así las vistas no cambian.
import { pedir } from './api.js';

const consulta = (filtros) => {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const texto = p.toString();
  return texto ? `?${texto}` : '';
};

export const fuenteApi = {
  empleados: () => pedir('GET', '/empleados'),
  tipos: () => pedir('GET', '/tipos'),
  parametros: () => pedir('GET', '/parametros'),
  registros: ({ desde, hasta, anio, semana, empleadoId } = {}) =>
    pedir('GET', `/registros${consulta({ desde, hasta, anio, semana, empleado: empleadoId })}`),
  recientes: (limite) => pedir('GET', `/registros/recientes?limite=${limite}`),
  semanasConDatos: () => pedir('GET', '/registros/semanas'),
  semanasCerradas: () => pedir('GET', '/semanas-cerradas'),
  conteos: () => pedir('GET', '/registros/conteos'),
  registro: (id) => pedir('GET', `/registros/${id}`),

  // El usuario lo conoce la API por la cookie: el segundo argumento sólo existe por el almacén de prueba.
  crearRegistro: (datos) => pedir('POST', '/registros', { ...datos, usuario: undefined }),
  editarRegistro: (id, datos) => pedir('PATCH', `/registros/${id}`, datos),
  eliminarRegistros: (ids) => pedir('POST', '/registros/eliminar', { ids }),
  cerrarSemana: ({ anio, semana }) => pedir('POST', '/semanas-cerradas', { anio, semana }),
  crearEmpleado: (datos) => pedir('POST', '/empleados', datos),
  cambiarActivo: (id, activo) => pedir('PATCH', `/empleados/${id}`, { activo }),
  guardarTarifas: (cambios) => pedir('PATCH', '/tipos', { cambios }),
  guardarParametros: (cambios) => pedir('PATCH', '/parametros', { cambios }),
};
