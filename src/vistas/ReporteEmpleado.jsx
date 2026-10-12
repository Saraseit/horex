import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alimentos from '../componentes/Alimentos.jsx';
import BorradoMasivo from '../componentes/BorradoMasivo.jsx';
import BarrasHorizontales from '../componentes/BarrasHorizontales.jsx';
import BarrasVerticales from '../componentes/BarrasVerticales.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import FilaKpis from '../componentes/FilaKpis.jsx';
import Insignia from '../componentes/Insignia.jsx';
import Kpi from '../componentes/Kpi.jsx';
import PildoraTipo from '../componentes/PildoraTipo.jsx';
import Segmentado from '../componentes/Segmentado.jsx';
import Tabla from '../componentes/Tabla.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { columnaSeleccion, useSeleccion } from '../componentes/seleccion.jsx';
import { useToast } from '../componentes/useToast.js';
import {
  useConteos, useEliminarRegistros, useEmpleados, useRegistrosEmpleado, useSemanasCerradas, useTipos,
} from '../datos/consultas.js';
import { barrasDelRango, domingos, porTipo, sumar } from '../logica/agregados.js';
import { desplazarSemana, fechasDeSemanas, hoy, semanaISO, semanasEntre } from '../logica/fechas.js';
import { fechaLarga, fmtHoras, fmtMoneda, fmtTarifa, siNo } from '../logica/formato.js';
import { etiquetaTipo } from '../logica/reglas.js';
import { useSesion } from '../sesion/contexto.js';

const RANGOS = [
  { valor: '4', etiqueta: 'Últimas 4 semanas' },
  { valor: '8', etiqueta: '8 semanas' },
  { valor: 'anio', etiqueta: 'Este año' },
];

/** Semanas completas (lunes a domingo) que cubre cada opción de rango, hasta la semana actual. */
function calcularRango(rango, actual) {
  const primera = rango === 'anio'
    ? { anio: actual.anio, semana: 1 }
    : desplazarSemana(actual, rango === '8' ? -7 : -3);
  const semanas = semanasEntre(primera, actual);
  return {
    semanas,
    ...fechasDeSemanas(primera, actual),
    descripcion: rango === 'anio' ? `Año ${actual.anio} · semanas 1–${actual.semana}` : `Semanas ${primera.semana}–${actual.semana}`,
  };
}

export default function ReporteEmpleado() {
  const { id } = useParams();
  const [busqueda, setBusqueda] = useSearchParams();
  const navegar = useNavigate();
  const rango = RANGOS.some((r) => r.valor === busqueda.get('rango')) ? busqueda.get('rango') : '4';
  const actual = semanaISO(hoy());
  const { desde, hasta, semanas, descripcion } = calcularRango(rango, actual);
  const toast = useToast();
  const { esSupervisor } = useSesion();
  const marcados = useSeleccion();
  const eliminar = useEliminarRegistros();

  const empleadosQ = useEmpleados();
  const conteosQ = useConteos();
  const tiposQ = useTipos();
  const cerradasQ = useSemanasCerradas();
  const conRegistros = (empleadosQ.data ?? [])
    .filter((e) => conteosQ.data?.porEmpleado[e.id] > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const empleadoId = id ? Number(id) : conRegistros[0]?.id;
  const registrosQ = useRegistrosEmpleado(empleadoId, desde, hasta);

  const base = [empleadosQ, conteosQ, tiposQ, cerradasQ];
  if (base.some((q) => q.isPending)) return <Cargando error={base.find((q) => q.error)?.error} />;
  const empleado = empleadosQ.data.find((e) => e.id === empleadoId);
  if (!empleado) {
    return (
      <section className="view">
        <EncabezadoVista titulo="Reporte por empleado" subtitulo="Todavía no hay registros capturados" />
      </section>
    );
  }
  if (registrosQ.isPending) return <Cargando error={registrosQ.error} />;

  // Como la demo: historial de la fecha más reciente a la más antigua.
  const regs = [...registrosQ.data].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id - b.id);
  const s = sumar(regs);
  const tipos = tiposQ.data;
  const opciones = conRegistros.some((e) => e.id === empleado.id) ? conRegistros : [...conRegistros, empleado];

  const barras = barrasDelRango(regs, semanas, actual);

  // Borrado masivo: sólo el supervisor y sólo registros de semanas abiertas.
  const cerrada = (r) => cerradasQ.data.some((c) => c.anio_iso === r.anio_iso && c.semana === r.semana);
  const elegibles = esSupervisor ? regs.filter((r) => !cerrada(r)).map((r) => r.id) : [];
  const cuantosMarcados = elegibles.filter((rid) => marcados.tiene(rid)).length;
  function eliminarMarcados() {
    eliminar.mutate(elegibles.filter((rid) => marcados.tiene(rid)), {
      onSuccess: ({ eliminados: n }) => {
        toast(n === 1 ? 'Registro eliminado' : `${n} registros eliminados`);
        marcados.limpiar();
      },
      onError: (e) => toast(e.message),
    });
  }

  const horasPorTipo = porTipo(regs)
    .filter((t) => t.horas > 0)
    .sort((a, b) => b.horas - a.horas)
    .map((t) => ({ clave: t.clave, etiqueta: etiquetaTipo(t.clave, tipos), valor: t.horas, texto: fmtHoras(t.horas) }));

  const cambiarParametros = (cambios) => {
    const nueva = new URLSearchParams(busqueda);
    Object.entries(cambios).forEach(([k, v]) => nueva.set(k, v));
    setBusqueda(nueva, { replace: true });
  };

  const columnasBase = [
    { id: 'sem', encabezado: 'Sem.', claseCelda: 'mono faint', celda: (r) => r.semana },
    { id: 'fecha', encabezado: 'Fecha', celda: (r) => fechaLarga(r.fecha) },
    { id: 'tipo', encabezado: 'Tipo', celda: (r) => <PildoraTipo clave={r.tipo_clave} etiqueta={r.tipo_etiqueta} /> },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', celda: (r) => r.horas || '—' },
    { id: 'tarifa', encabezado: 'Tarifa', tipo: 'num', celda: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—') },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', celda: (r) => fmtMoneda(r.importe_he) },
    { id: 'alim', encabezado: 'Alim.', tipo: 'ctr', celda: (r) => <Alimentos registro={r} /> },
    { id: 'total', encabezado: 'Total', tipo: 'num', celda: (r) => <b>{fmtMoneda(r.total)}</b> },
  ];
  const columnas = esSupervisor
    ? [columnaSeleccion({ seleccion: marcados, elegibles, motivoBloqueo: () => 'Semana cerrada: no se puede eliminar' }), ...columnasBase]
    : columnasBase;

  return (
    <section className="view">
      <EncabezadoVista
        titulo={empleado.nombre}
        subtitulo={<>
          {empleado.puesto}{' '}
          <Insignia variante={empleado.grupo === 'Eventual' ? 'amber' : undefined}>{empleado.grupo}</Insignia>{' '}
          <Insignia variante="grey">IMSS: {siNo(empleado.imss)}</Insignia>{' '}
          {!empleado.genera_he && <Insignia variante="ok">Solo alimentos</Insignia>}
        </>}
      >
        <Segmentado opciones={RANGOS} valor={rango} alCambiar={(v) => cambiarParametros({ rango: v })} />
        <select
          className="select sm" id="emp-sel" aria-label="Empleado" value={empleado.id}
          onChange={(e) => navegar({ pathname: `/reportes/empleado/${e.target.value}`, search: busqueda.toString() })}
        >
          {opciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </EncabezadoVista>

      <FilaKpis>
        <Kpi etiqueta="Horas extra" valor={fmtHoras(s.horas)} sub={descripcion} />
        <Kpi etiqueta="Importe HE" valor={fmtMoneda(s.he)} sub={`${s.registros} registros`} />
        <Kpi etiqueta="Promedio semanal" valor={fmtMoneda(s.total / semanas.length)} sub={`${domingos(regs).length} domingos trabajados`} />
        <Kpi etiqueta="Total acumulado" valor={fmtMoneda(s.total)} sub={`Alimentos ${fmtMoneda(s.alim)}`} hero />
      </FilaKpis>

      <div className="grid-3-1">
        <Tarjeta
          titulo={barras.porMes ? 'Total por mes' : 'Total por semana'}
          subtitulo={barras.porMes
            ? 'HE + alimentos · cada semana cuenta en el mes de su jueves · mes actual en ámbar'
            : 'HE + alimentos · semana actual en ámbar'}
        >
          <BarrasVerticales items={barras.items} formato={fmtMoneda} />
        </Tarjeta>
        <Tarjeta titulo="Horas por tipo">
          <BarrasHorizontales
            filas={horasPorTipo}
            estiloFila={{ gridTemplateColumns: '110px 1fr auto' }}
            vacio={<div className="faint">Sin horas extra (solo alimentos)</div>}
          />
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Historial de registros"
        conCuerpo={false}
        accion={esSupervisor && (
          <BorradoMasivo cantidad={cuantosMarcados} ocupado={eliminar.isPending} alConfirmar={eliminarMarcados} />
        )}
      >
        <Tabla
          columnas={columnas}
          filas={regs}
          clave={(r) => r.id}
          claseFila={(r) => (marcados.tiene(r.id) ? 'seleccionada' : undefined)}
          pie={<>
            <td colSpan={columnas.length - columnasBase.length + 3}>Total</td>
            <td className="num">{fmtHoras(s.horas)}</td>
            <td />
            <td className="num">{fmtMoneda(s.he)}</td>
            <td className="num">{fmtMoneda(s.alim)}</td>
            <td className="num">{fmtMoneda(s.total)}</td>
          </>}
        />
      </Tarjeta>
    </section>
  );
}
