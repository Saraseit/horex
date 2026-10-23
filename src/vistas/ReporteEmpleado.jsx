import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AccionesRegistros from '../componentes/AccionesRegistros.jsx';
import BarrasHorizontales from '../componentes/BarrasHorizontales.jsx';
import BarrasVerticales from '../componentes/BarrasVerticales.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import FilaKpis from '../componentes/FilaKpis.jsx';
import Insignia from '../componentes/Insignia.jsx';
import Kpi from '../componentes/Kpi.jsx';
import MontoComida from '../componentes/MontoComida.jsx';
import PildoraTipo from '../componentes/PildoraTipo.jsx';
import Segmentado from '../componentes/Segmentado.jsx';
import Tabla from '../componentes/Tabla.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { columnaSeleccion, useSeleccion } from '../componentes/seleccion.jsx';
import { useRecibos } from '../componentes/useRecibos.js';
import { useToast } from '../componentes/useToast.js';
import {
  useConteos, useEliminarRegistros, useEmpleados, useRegistrosEmpleado, useTipos,
} from '../datos/consultas.js';
import { barrasDelRango, domingos, porTipo, sumar } from '../logica/agregados.js';
import { desplazarSemana, fechasDeSemanas, hoy, semanaCaptura, semanasEntre } from '../logica/fechas.js';
import { fechaLarga, fmtHoras, fmtMoneda, fmtTarifa, resumenComidas, siNo } from '../logica/formato.js';
import { COMIDAS, etiquetaTipo } from '../logica/reglas.js';
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
  const actual = semanaCaptura();
  const { desde, hasta, semanas, descripcion } = calcularRango(rango, actual);
  const toast = useToast();
  const { esSupervisor } = useSesion();
  const marcados = useSeleccion();
  const eliminar = useEliminarRegistros();
  const recibos = useRecibos();
  const [fechaPago, setFechaPago] = useState(hoy());

  const empleadosQ = useEmpleados();
  const conteosQ = useConteos();
  const tiposQ = useTipos();
  const conRegistros = (empleadosQ.data ?? [])
    .filter((e) => conteosQ.data?.porEmpleado[e.id] > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const empleadoId = id ? Number(id) : conRegistros[0]?.id;
  const registrosQ = useRegistrosEmpleado(empleadoId, desde, hasta);

  const base = [empleadosQ, conteosQ, tiposQ];
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

  // Casillas: recibos para cualquiera; eliminar, sólo el supervisor (también en semanas cerradas).
  const seleccionados = regs.filter((r) => marcados.tiene(r.id));
  function eliminarMarcados(ids) {
    eliminar.mutate(ids, {
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
    { id: 'sem', encabezado: 'Sem.', claseCelda: 'mono faint', orden: (r) => r.anio_iso * 100 + r.semana, texto: (r) => String(r.semana), celda: (r) => r.semana },
    { id: 'fecha', encabezado: 'Fecha', orden: (r) => `${r.fecha} ${String(r.id).padStart(9, '0')}`, texto: (r) => fechaLarga(r.fecha), celda: (r) => fechaLarga(r.fecha) },
    { id: 'tipo', encabezado: 'Tipo', orden: (r) => r.tipo_etiqueta, celda: (r) => <PildoraTipo clave={r.tipo_clave} etiqueta={r.tipo_etiqueta} /> },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', orden: (r) => r.horas, texto: (r) => String(r.horas || '—'), celda: (r) => r.horas || '—' },
    { id: 'tarifa', encabezado: 'Tarifa', tipo: 'num', orden: (r) => r.tarifa_aplicada, texto: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—'), celda: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—') },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', orden: (r) => r.importe_he, texto: (r) => fmtMoneda(r.importe_he), celda: (r) => fmtMoneda(r.importe_he) },
    ...COMIDAS.map((c) => ({
      id: c.clave,
      encabezado: c.etiqueta,
      tipo: 'num',
      orden: (r) => r[`importe_${c.clave}`],
      texto: (r) => (r[c.clave] ? fmtMoneda(r[`importe_${c.clave}`]) : '—'),
      celda: (r) => (r[c.clave] ? fmtMoneda(r[`importe_${c.clave}`]) : <span className="faint">—</span>),
    })),
    { id: 'total', encabezado: 'Total', tipo: 'num', orden: (r) => r.total, texto: (r) => fmtMoneda(r.total), celda: (r) => <b>{fmtMoneda(r.total)}</b> },
    {
      id: 'recibo',
      encabezado: '',
      estiloCelda: { textAlign: 'right' },
      celda: (r) => (
        <span className="acciones">
          <button type="button" className="btn btn-ghost btn-xs" disabled={recibos.generando} onClick={() => recibos.descargar([r], fechaPago)}>Recibo</button>
          {esSupervisor && (
            <button type="button" className="btn btn-ghost btn-xs" aria-label="Editar" title="Editar registro" onClick={() => navegar(`/registrar?editar=${r.id}`)}>✎</button>
          )}
        </span>
      ),
    },
  ];
  const columnas = [columnaSeleccion({ seleccion: marcados, elegibles: regs.map((r) => r.id) }), ...columnasBase];

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
        <Kpi etiqueta="Total acumulado" valor={fmtMoneda(s.total)} sub={`Alimentos ${fmtMoneda(s.alim)} · ${resumenComidas(s)}`} hero />
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
        <div className="stack" style={{ gap: 20 }}>
          <Tarjeta titulo="Horas por tipo">
            <BarrasHorizontales
              filas={horasPorTipo}
              estiloFila={{ gridTemplateColumns: '110px 1fr auto' }}
              vacio={<div className="faint">Sin horas extra (solo alimentos)</div>}
            />
          </Tarjeta>
          <Tarjeta titulo="Alimentos" subtitulo="Cantidad y monto de cada comida">
            <div className="rule-list">
              {COMIDAS.map((c) => (
                <div key={c.clave} className="rule"><span>{c.plural} ({s[c.cantidad]})</span><b>{fmtMoneda(s[c.importe])}</b></div>
              ))}
              <div className="rule"><span>Total alimentos</span><b>{fmtMoneda(s.alim)}</b></div>
            </div>
          </Tarjeta>
        </div>
      </div>

      <Tarjeta
        titulo="Historial de registros"
        subtitulo="▾ en un encabezado para ordenar y filtrar"
        conCuerpo={false}
        accion={(
          <AccionesRegistros
            marcados={seleccionados}
            fechaPago={fechaPago}
            alCambiarFecha={setFechaPago}
            puedeBorrar={esSupervisor}
            alEliminar={eliminarMarcados}
            eliminando={eliminar.isPending}
          />
        )}
      >
        <Tabla
          columnas={columnas}
          filas={regs}
          clave={(r) => r.id}
          compacta
          claseFila={(r) => (marcados.tiene(r.id) ? 'seleccionada' : undefined)}
          alFiltrar={marcados.limpiar}
          pie={(visibles) => {
            // Los totales siguen a los filtros de la tabla.
            const t = sumar(visibles);
            return <>
              <td colSpan={columnas.length - columnasBase.length + 3}>{visibles.length === regs.length ? 'Total' : 'Total filtrado'}</td>
              <td className="num">{fmtHoras(t.horas)}</td>
              <td />
              <td className="num">{fmtMoneda(t.he)}</td>
              {COMIDAS.map((c) => <td key={c.clave} className="num"><MontoComida monto={t[c.importe]} cantidad={t[c.cantidad]} /></td>)}
              <td className="num">{fmtMoneda(t.total)}</td>
              <td />
            </>;
          }}
        />
      </Tarjeta>
    </section>
  );
}
