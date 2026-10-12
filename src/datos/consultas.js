// Hooks de datos. Las vistas sólo usan estos hooks; en las fases 2–4 cambia la fuente (API) y no las vistas.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '../sesion/contexto.js';
import { almacen } from './almacenPrueba.js';

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
export const useEliminarRegistro = () => useMutacion((id, usuario) => almacen.eliminarRegistro(id, usuario), [['registros']]);
export const useCerrarSemana = () => useMutacion((semana, usuario) => almacen.cerrarSemana(semana, usuario), [['semanas-cerradas']]);
export const useCrearEmpleado = () => useMutacion((datos, usuario) => almacen.crearEmpleado(datos, usuario), [['empleados']]);
export const useCambiarActivo = () => useMutacion(({ id, activo }, usuario) => almacen.cambiarActivo(id, activo, usuario), [['empleados']]);
export const useGuardarTarifas = () => useMutacion((cambios, usuario) => almacen.guardarTarifas(cambios, usuario), [['tipos']]);
