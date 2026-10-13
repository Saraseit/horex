// Hooks de datos. Las vistas sólo usan estos hooks. La fuente es la API; en modo de prueba
// (pruebas de Playwright) es el almacén en memoria con los datos de la demo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DATOS_PRUEBA } from '../configuracion.js';
import { useSesion } from '../sesion/contexto.js';
import { almacen as almacenPrueba } from './almacenPrueba.js';
import { fuenteApi } from './fuenteApi.js';

const almacen = DATOS_PRUEBA ? almacenPrueba : fuenteApi;

export const useEmpleados = () => useQuery({ queryKey: ['empleados'], queryFn: almacen.empleados });
export const useTipos = () => useQuery({ queryKey: ['tipos'], queryFn: almacen.tipos });
export const useParametros = () => useQuery({ queryKey: ['parametros'], queryFn: almacen.parametros });
export const useSemanasConDatos = () => useQuery({ queryKey: ['registros', 'semanas'], queryFn: almacen.semanasConDatos });
export const useSemanasCerradas = () => useQuery({ queryKey: ['semanas-cerradas'], queryFn: almacen.semanasCerradas });
export const useConteos = () => useQuery({ queryKey: ['registros', 'conteos'], queryFn: almacen.conteos });

export const useRegistrosSemana = ({ anio, semana }) => useQuery({
  queryKey: ['registros', 'semana', anio, semana],
  queryFn: () => almacen.registros({ anio, semana }),
});

export const useRegistrosRango = (desde, hasta) => useQuery({
  queryKey: ['registros', 'rango', desde, hasta],
  queryFn: () => almacen.registros({ desde, hasta }),
});

export const useRegistrosEmpleado = (empleadoId, desde, hasta) => useQuery({
  queryKey: ['registros', 'empleado', empleadoId, desde, hasta],
  queryFn: () => almacen.registros({ empleadoId, desde, hasta }),
  enabled: !!empleadoId,
});

/** Registros del empleado en esa fecha (aviso de duplicado). */
export const useRegistrosDia = (empleadoId, fecha) => useQuery({
  queryKey: ['registros', 'dia', empleadoId, fecha],
  queryFn: () => almacen.registros({ empleadoId, desde: fecha, hasta: fecha }),
  enabled: !!empleadoId && !!fecha,
});

export const useRegistro = (id) => useQuery({
  queryKey: ['registros', 'uno', id],
  queryFn: () => almacen.registro(id),
  enabled: !!id,
});

export const useRegistrosRecientes = (limite = 7) => useQuery({
  queryKey: ['registros', 'recientes', limite],
  queryFn: () => almacen.recientes(limite),
});

function useMutacion(fn, claves) {
  const cliente = useQueryClient();
  const { usuario } = useSesion();
  return useMutation({
    mutationFn: (datos) => fn(datos, usuario),
    onSuccess: () => Promise.all(claves.map((queryKey) => cliente.invalidateQueries({ queryKey }))),
  });
}

export const useCrearRegistro = () => useMutacion((datos, usuario) => almacen.crearRegistro({ ...datos, usuario }), [['registros']]);
export const useEditarRegistro = () => useMutacion(({ id, ...datos }, usuario) => almacen.editarRegistro(id, datos, usuario), [['registros']]);
/** Recibe una lista de ids (uno o varios). */
export const useEliminarRegistros = () => useMutacion((ids, usuario) => almacen.eliminarRegistros(ids, usuario), [['registros']]);
export const useGuardarParametros = () => useMutacion((cambios, usuario) => almacen.guardarParametros(cambios, usuario), [['parametros']]);
export const useCerrarSemana = () => useMutacion((semana, usuario) => almacen.cerrarSemana(semana, usuario), [['semanas-cerradas']]);
export const useCrearEmpleado = () => useMutacion((datos, usuario) => almacen.crearEmpleado(datos, usuario), [['empleados']]);
export const useCambiarActivo = () => useMutacion(({ id, activo }, usuario) => almacen.cambiarActivo(id, activo, usuario), [['empleados']]);
export const useGuardarTarifas = () => useMutacion((cambios, usuario) => almacen.guardarTarifas(cambios, usuario), [['tipos']]);
