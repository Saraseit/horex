// Fase 1: base de datos en memoria con los datos de la demo. Imita lo que harán Postgres y la API
// (tarifa calculada al guardar, semanas cerradas, borrado lógico, permisos) para que las vistas ya
// trabajen con la forma final de los datos. Se reemplaza por llamadas a la API en las fases 2–4.
import { compararSemanas, hoy, semanaISO } from '../logica/fechas.js';
import { normalizar } from '../logica/formato.js';
import { calcularTarifa, completarRegistro, etiquetaTipo } from '../logica/reglas.js';
import {
  EMPLEADOS_PRUEBA, PARAMETROS_PRUEBA, SEMANAS_CERRADAS_PRUEBA, TIPOS_PRUEBA, generarRegistrosPrueba,
} from './datosPrueba.js';

const estado = {
  empleados: structuredClone(EMPLEADOS_PRUEBA),
  tipos: structuredClone(TIPOS_PRUEBA),
  parametros: { ...PARAMETROS_PRUEBA },
  registros: generarRegistrosPrueba().map(completarRegistro),
  semanasCerradas: structuredClone(SEMANAS_CERRADAS_PRUEBA),
};

const responder = (valor) => new Promise((ok) => setTimeout(() => ok(structuredClone(valor)), 0));
const fallar = (mensaje) => Promise.reject(new Error(mensaje));

const vigentes = () => estado.registros.filter((r) => !r.eliminado_at);
const estaCerrada = ({ anio, semana }) => estado.semanasCerradas.some((s) => s.anio_iso === anio && s.semana === semana);

/** Como la vista v_registros: registro + datos del empleado + etiqueta del tipo. */
function conEmpleado(r) {
  const e = estado.empleados.find((x) => x.id === r.empleado_id);
  return {
    ...r,
    nombre: e.nombre, puesto: e.puesto, grupo: e.grupo, reclutador: e.reclutador, imss: e.imss,
    tipo_etiqueta: etiquetaTipo(r.tipo_clave, estado.tipos),
  };
}

function exigirSupervisor(usuario) {
  if (usuario?.rol !== 'SUPERVISOR') throw new Error('Solo el supervisor puede hacer esto.');
}

export const almacen = {
  empleados: () => responder(estado.empleados),
  tipos: () => responder([...estado.tipos].sort((a, b) => a.orden - b.orden)),
  parametros: () => responder(estado.parametros),

  /** Filtros opcionales: desde/hasta (fechas), anio+semana, empleadoId. Orden: id ascendente. */
  registros({ desde, hasta, anio, semana, empleadoId } = {}) {
    const lista = vigentes().filter((r) => (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta)
      && (!anio || (r.anio_iso === anio && r.semana === semana))
      && (!empleadoId || r.empleado_id === empleadoId));
    return responder(lista.map(conEmpleado));
  },

  recientes: (limite) => responder([...vigentes()].sort((a, b) => b.id - a.id).slice(0, limite).map(conEmpleado)),

  semanasConDatos() {
    const vistas = new Map(vigentes().map((r) => [`${r.anio_iso}-${r.semana}`, { anio: r.anio_iso, semana: r.semana }]));
    return responder([...vistas.values()].sort(compararSemanas));
  },

  semanasCerradas: () => responder(estado.semanasCerradas),

  conteos() {
    const porEmpleado = {};
    const porTipo = {};
    for (const r of vigentes()) {
      porEmpleado[r.empleado_id] = (porEmpleado[r.empleado_id] || 0) + 1;
      if (r.tipo_clave) porTipo[r.tipo_clave] = (porTipo[r.tipo_clave] || 0) + 1;
    }
    return responder({ porEmpleado, porTipo });
  },

  crearRegistro(datos) {
    const empleado = estado.empleados.find((e) => e.id === datos.empleado_id);
    if (!empleado) return fallar('El empleado no existe.');
    if (!empleado.activo) return fallar(`${empleado.nombre} está inactivo: no se le pueden capturar registros.`);
    if (!datos.fecha || datos.fecha > hoy()) return fallar('No se pueden capturar fechas futuras.');
    const semana = semanaISO(datos.fecha);
    if (estaCerrada(semana)) return fallar(`La semana ${semana.semana} está cerrada: ya no acepta registros.`);

    // Igual que el trigger: el cliente no decide la tarifa.
    const tipoClave = empleado.genera_he ? datos.tipo_clave : null;
    const horas = empleado.genera_he ? Number(datos.horas) : 0;
    if (!tipoClave && horas !== 0) return fallar('Un registro sin tipo de hora no puede llevar horas.');
    if (!tipoClave && !(datos.desayuno || datos.almuerzo || datos.cena)) return fallar('Un registro sin horas extra debe llevar al menos un alimento.');
    if (horas < 0 || horas > 16) return fallar('Las horas deben estar entre 0 y 16.');
    const { tarifa } = calcularTarifa({ empleado, fecha: datos.fecha, tipoClave, tipos: estado.tipos, parametros: estado.parametros });

    const registro = completarRegistro({
      id: Math.max(0, ...estado.registros.map((r) => r.id)) + 1,
      empleado_id: empleado.id,
      fecha: datos.fecha,
      tipo_clave: tipoClave,
      horas,
      tarifa_aplicada: tarifa,
      desayuno: !!datos.desayuno,
      almuerzo: !!datos.almuerzo,
      cena: !!datos.cena,
      monto_alimento: estado.parametros.monto_alimento,
      capturado_por_nombre: datos.usuario.nombre,
    });
    estado.registros.push(registro);
    return responder(conEmpleado(registro));
  },

  eliminarRegistro(id, usuario) {
    try { exigirSupervisor(usuario); } catch (e) { return fallar(e.message); }
    const r = estado.registros.find((x) => x.id === id && !x.eliminado_at);
    if (!r) return fallar('El registro ya no existe.');
    if (estaCerrada({ anio: r.anio_iso, semana: r.semana })) return fallar(`La semana ${r.semana} está cerrada: no se pueden eliminar registros.`);
    r.eliminado_at = new Date().toISOString();
    r.eliminado_por_nombre = usuario.nombre;
    return responder({ id });
  },

  cerrarSemana({ anio, semana }, usuario) {
    try { exigirSupervisor(usuario); } catch (e) { return fallar(e.message); }
    if (estaCerrada({ anio, semana })) return fallar(`La semana ${semana} ya estaba cerrada.`);
    estado.semanasCerradas.push({ anio_iso: anio, semana, cerrada_por_nombre: usuario.nombre });
    return responder({ anio, semana });
  },

  crearEmpleado(datos, usuario) {
    try { exigirSupervisor(usuario); } catch (e) { return fallar(e.message); }
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ');
    if (!nombre) return fallar('Escribe el nombre completo.');
    if (estado.empleados.some((e) => normalizar(e.nombre) === normalizar(nombre))) return fallar('Ya existe un empleado con ese nombre');
    const empleado = {
      id: Math.max(...estado.empleados.map((e) => e.id)) + 1,
      nombre,
      puesto: datos.puesto,
      grupo: datos.grupo,
      reclutador: datos.grupo === 'Eventual' ? 'EVENTUAL' : 'FIJO',
      imss: !!datos.imss,
      genera_he: !!datos.genera_he,
      activo: true,
    };
    estado.empleados.push(empleado);
    return responder(empleado);
  },

  cambiarActivo(id, activo, usuario) {
    try { exigirSupervisor(usuario); } catch (e) { return fallar(e.message); }
    const e = estado.empleados.find((x) => x.id === id);
    e.activo = activo;
    return responder(e);
  },

  /** cambios: { CLAVE: tarifa }. Devuelve cuántas tarifas cambiaron. Nunca toca registros guardados. */
  guardarTarifas(cambios, usuario) {
    try { exigirSupervisor(usuario); } catch (e) { return fallar(e.message); }
    let n = 0;
    for (const t of estado.tipos) {
      const v = cambios[t.clave];
      if (v !== undefined && v >= 0 && Number(t.tarifa) !== v) { t.tarifa = v; n += 1; }
    }
    return responder({ cambiadas: n });
  },
};
