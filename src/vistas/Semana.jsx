import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AccionesRegistros from '../componentes/AccionesRegistros.jsx';
import Cargando from '../componentes/Cargando.jsx';
import ConfirmacionEnLinea from '../componentes/ConfirmacionEnLinea.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import FilaKpis from '../componentes/FilaKpis.jsx';
import Insignia from '../componentes/Insignia.jsx';
import Kpi from '../componentes/Kpi.jsx';
import MontoComida from '../componentes/MontoComida.jsx';
import PildoraTipo from '../componentes/PildoraTipo.jsx';
import Tabla from '../componentes/Tabla.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { columnaSeleccion, useSeleccion } from '../componentes/seleccion.jsx';
import { useRecibos } from '../componentes/useRecibos.js';
import { useToast } from '../componentes/useToast.js';
import {
  useCerrarSemana, useEliminarRegistros, useRegistrosSemana, useSemanasCerradas, useSemanasConDatos,
} from '../datos/consultas.js';
import { porDia, porEmpleado, sumar } from '../logica/agregados.js';
import {
  DIAS_CORTOS, claveSemana, compararSemanas, desplazarSemana, diasDeSemana, etiquetaSemana, hoy, indiceDia,
  leerClaveSemana, parseD, rangoSemanaTexto, semanaCaptura, semanasParaElegir,
} from '../logica/fechas.js';
import { fechaLarga, fmtHoras, fmtMoneda, fmtTarifa, nombreCorto, redondear1, resumenComidas } from '../logica/formato.js';
import { COMIDAS } from '../logica/reglas.js';
import { useSesion } from '../sesion/contexto.js';

const DOMINGO = 6;

export default function Semana() {
  const params = useParams();
  const actual = semanaCaptura();
  const seleccion = params.anio && params.semana
    ? { anio: Number(params.anio), semana: Number(params.semana) }
    : actual;
  // La key reinicia las confirmaciones y las casillas marcadas al cambiar de semana.
  return <ContenidoSemana key={claveSemana(seleccion)} seleccion={seleccion} actual={actual} />;
}

function ContenidoSemana({ seleccion, actual }) {
  const navegar = useNavigate();
  const toast = useToast();
  const { esSupervisor } = useSesion();
  const registrosQ = useRegistrosSemana(seleccion);
  const semanasQ = useSemanasConDatos();
  const cerradasQ = useSemanasCerradas();
  const eliminar = useEliminarRegistros();
  const cerrar = useCerrarSemana();
  const marcados = useSeleccion();
  const recibos = useRecibos();
  const [confirmarId, setConfirmarId] = useState(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [fechaPago, setFechaPago] = useState(hoy());

  const consultas = [registrosQ, semanasQ, cerradasQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;

  const regs = registrosQ.data;
  const s = sumar(regs);
  const cerrada = cerradasQ.data.some((c) => c.anio_iso === seleccion.anio && c.semana === seleccion.semana);
  const opciones = semanasParaElegir(semanasQ.data, actual, seleccion);
  const ir = (o) => navegar(`/semana/${o.anio}/${o.semana}`);
  const dias = diasDeSemana(seleccion.anio, seleccion.semana);
  const empleados = porEmpleado(regs).sort((a, b) => a.lista[0].nombre.localeCompare(b.lista[0].nombre, 'es'));

  function cerrarSemana() {
    cerrar.mutate(seleccion, {
      onSuccess: () => toast(`Semana ${seleccion.semana} cerrada: ya no acepta capturas`),
      onError: (e) => toast(e.message),
      onSettled: () => setConfirmarCierre(false),
    });
  }

  function eliminarRegistros(ids) {
    eliminar.mutate(ids, {
      onSuccess: ({ eliminados: n }) => {
        toast(n === 1 ? 'Registro eliminado' : `${n} registros eliminados`);
        marcados.limpiar();
      },
      onError: (e) => toast(e.message),
      onSettled: () => setConfirmarId(null),
    });
  }

  const columnasDias = DIAS_CORTOS.map((d, i) => ({
    id: `dia-${i}`,
    encabezado: `${d} ${parseD(dias[i]).getDate()}`,
    claseEncabezado: i === DOMINGO ? 'ctr sun' : 'ctr',
    claseCelda: (fila) => {
      const delDia = fila.lista.filter((r) => indiceDia(r.fecha) === i);
      return ['day-cell', i === DOMINGO && 'sun', !delDia.length && 'empty'].filter(Boolean).join(' ');
    },
    celda: (fila) => {
      const delDia = fila.lista.filter((r) => indiceDia(r.fecha) === i);
      const h = delDia.reduce((a, r) => a + r.horas, 0);
      const comio = delDia.some((r) => r.importe_alimentos > 0);
      return <>{delDia.length ? (h ? redondear1(h) : '0') : '·'}{comio && <i className="meal" />}</>;
    },
  }));

  const columnasComidaTotales = COMIDAS.map((c) => ({
    id: c.clave,
    encabezado: c.etiqueta,
    tipo: 'num',
    orden: (f) => f[c.importe],
    texto: (f) => (f[c.importe] ? fmtMoneda(f[c.importe]) : '—'),
    celda: (f) => <MontoComida monto={f[c.importe]} cantidad={f[c.cantidad]} />,
  }));

  const columnasMatriz = [
    {
      id: 'empleado',
      encabezado: 'Empleado',
      orden: (f) => f.lista[0].nombre,
      texto: (f) => nombreCorto(f.lista[0].nombre),
      celda: (f) => <div className="emp-cell">{nombreCorto(f.lista[0].nombre)}<small>{f.lista[0].puesto} · {f.lista[0].grupo}</small></div>,
    },
    ...columnasDias,
    { id: 'horas', encabezado: 'Horas', tipo: 'num', orden: (f) => f.horas, texto: (f) => fmtHoras(f.horas), celda: (f) => fmtHoras(f.horas) },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', orden: (f) => f.he, texto: (f) => fmtMoneda(f.he), celda: (f) => fmtMoneda(f.he) },
    ...columnasComidaTotales,
    { id: 'total', encabezado: 'Total', tipo: 'num', orden: (f) => f.total, texto: (f) => fmtMoneda(f.total), celda: (f) => <b>{fmtMoneda(f.total)}</b> },
  ];

  function accion(r) {
    const recibo = (
      <button type="button" className="btn btn-ghost btn-xs" disabled={recibos.generando} onClick={() => recibos.descargar([r], fechaPago)}>
        Recibo
      </button>
    );
    if (!esSupervisor) return recibo;
    if (confirmarId === r.id) {
      return <ConfirmacionEnLinea alConfirmar={() => eliminarRegistros([r.id])} alCancelar={() => setConfirmarId(null)} ocupado={eliminar.isPending} />;
    }
    return (
      <span className="acciones">
        {recibo}
        <button type="button" className="btn btn-ghost btn-xs" aria-label="Editar" title="Editar registro" onClick={() => navegar(`/registrar?editar=${r.id}`)}>✎</button>
        <button type="button" className="btn btn-ghost btn-xs" aria-label="Eliminar" title="Eliminar registro" onClick={() => setConfirmarId(r.id)}>✕</button>
      </span>
    );
  }

  const detalle = [...regs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  const ids = detalle.map((r) => r.id);
  const columnasDetalle = [
    columnaSeleccion({ seleccion: marcados, elegibles: ids }),
    { id: 'fecha', encabezado: 'Fecha', orden: (r) => `${r.fecha} ${String(r.id).padStart(9, '0')}`, texto: (r) => fechaLarga(r.fecha), celda: (r) => fechaLarga(r.fecha) },
    { id: 'empleado', encabezado: 'Empleado', orden: (r) => r.nombre, texto: (r) => nombreCorto(r.nombre), celda: (r) => nombreCorto(r.nombre) },
    {
      id: 'tipo',
      encabezado: 'Tipo',
      orden: (r) => r.tipo_etiqueta,
      celda: (r) => <><PildoraTipo clave={r.tipo_clave} etiqueta={r.tipo_etiqueta} />{r.tarifa_manual && <> <span className="badge amber" title={r.nota}>manual</span></>}</>,
    },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', orden: (r) => r.horas, texto: (r) => String(r.horas || '—'), celda: (r) => r.horas || '—' },
    { id: 'tarifa', encabezado: 'Tarifa', tipo: 'num', orden: (r) => r.tarifa_aplicada, texto: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—'), celda: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—') },
    { id: 'importe', encabezado: 'Importe', tipo: 'num', orden: (r) => r.importe_he, texto: (r) => fmtMoneda(r.importe_he), celda: (r) => fmtMoneda(r.importe_he) },
    ...COMIDAS.map((c) => ({
      id: c.clave,
      encabezado: c.etiqueta,
      tipo: 'num',
      orden: (r) => r[`importe_${c.clave}`],
      texto: (r) => (r[c.clave] ? fmtMoneda(r[`importe_${c.clave}`]) : '—'),
      celda: (r) => (r[c.clave] ? fmtMoneda(r[`importe_${c.clave}`]) : <span className="faint">—</span>),
    })),
    { id: 'total', encabezado: 'Total', tipo: 'num', orden: (r) => r.total, texto: (r) => fmtMoneda(r.total), celda: (r) => <b>{fmtMoneda(r.total)}</b> },
    { id: 'capturo', encabezado: 'Capturó', claseCelda: 'faint capturo', estiloCelda: { fontSize: 12 }, celda: (r) => <span title={r.capturado_por_nombre}>{r.capturado_por_nombre}</span> },
    { id: 'accion', encabezado: '', estiloCelda: { textAlign: 'right' }, celda: accion },
  ];
  const seleccionados = detalle.filter((r) => marcados.tiene(r.id));

  const subtituloDetalle = esSupervisor
    ? 'Marca registros para descargar sus recibos o eliminarlos (también en semanas cerradas)'
    : 'Marca registros para descargar sus recibos · solo el supervisor puede eliminar';

  return (
    <section className="view">
      <EncabezadoVista
        titulo={`Semana ${seleccion.semana}`}
        subtitulo={<>{rangoSemanaTexto(seleccion.anio, seleccion.semana)} {cerrada
          ? <Insignia variante="grey">Cerrada · pagada</Insignia>
          : <Insignia variante="ok">Abierta · en captura</Insignia>}</>}
      >
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Semana anterior" disabled={compararSemanas(seleccion, opciones[0]) <= 0} onClick={() => ir(desplazarSemana(seleccion, -1))}>‹</button>
        <select className="select sm" id="sem-select" aria-label="Semana" value={claveSemana(seleccion)} onChange={(e) => ir(leerClaveSemana(e.target.value))}>
          {opciones.map((o) => <option key={claveSemana(o)} value={claveSemana(o)}>{etiquetaSemana(o, actual)}</option>)}
        </select>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Semana siguiente" disabled={compararSemanas(seleccion, actual) >= 0} onClick={() => ir(desplazarSemana(seleccion, 1))}>›</button>
        {!cerrada && (confirmarCierre
          ? <ConfirmacionEnLinea pregunta="¿Cerrar semana?" alConfirmar={cerrarSemana} alCancelar={() => setConfirmarCierre(false)} ocupado={cerrar.isPending} />
          : (
            <button type="button" className="btn btn-brand" disabled={!esSupervisor} title={esSupervisor ? undefined : 'Solo supervisor'} onClick={() => setConfirmarCierre(true)}>
              Cerrar semana
            </button>
          ))}
      </EncabezadoVista>

      <FilaKpis>
        <Kpi etiqueta="Horas extra" valor={fmtHoras(s.horas)} sub={`${s.registros} registros`} />
        <Kpi etiqueta="Importe HE" valor={fmtMoneda(s.he)} sub={`${empleados.length} empleados`} />
        <Kpi etiqueta="Alimentos" valor={fmtMoneda(s.alim)} sub={resumenComidas(s)} />
        <Kpi etiqueta="Total a pagar" valor={fmtMoneda(s.total)} sub="HE + alimentos" hero />
      </FilaKpis>

      <Tarjeta titulo="Horas por empleado y día" subtitulo="Punto ámbar = alimentos ese día · ▾ en un encabezado para ordenar y filtrar · clic en una fila para ver el detalle" conCuerpo={false}>
        {empleados.length ? (
          <Tabla
            columnas={columnasMatriz}
            filas={empleados}
            clave={(f) => f.empleado_id}
            compacta
            alClicFila={(f) => navegar(`/reportes/empleado/${f.empleado_id}`)}
            pie={(visibles) => {
              // Los totales siguen a los filtros de la tabla.
              const lista = visibles.flatMap((f) => f.lista);
              const t = sumar(lista);
              const dia = porDia(lista).map((l) => l.reduce((h, r) => h + r.horas, 0));
              return <>
                <td>{visibles.length === empleados.length ? 'Total semana' : 'Total filtrado'}</td>
                {dia.map((h, i) => <td key={i} className={i === DOMINGO ? 'day-cell sun' : 'day-cell'}>{h ? redondear1(h) : '·'}</td>)}
                <td className="num">{fmtHoras(t.horas)}</td>
                <td className="num">{fmtMoneda(t.he)}</td>
                {COMIDAS.map((c) => <td key={c.clave} className="num"><MontoComida monto={t[c.importe]} cantidad={t[c.cantidad]} /></td>)}
                <td className="num">{fmtMoneda(t.total)}</td>
              </>;
            }}
          />
        ) : <div className="empty-state">Sin registros esta semana</div>}
      </Tarjeta>

      <Tarjeta
        titulo="Registros de la semana"
        subtitulo={subtituloDetalle}
        conCuerpo={false}
        accion={(
          <AccionesRegistros
            marcados={seleccionados}
            fechaPago={fechaPago}
            alCambiarFecha={setFechaPago}
            puedeBorrar={esSupervisor}
            alEliminar={eliminarRegistros}
            eliminando={eliminar.isPending}
          />
        )}
      >
        <Tabla
          columnas={columnasDetalle}
          filas={detalle}
          clave={(r) => r.id}
          compacta
          claseFila={(r) => (marcados.tiene(r.id) ? 'seleccionada' : undefined)}
          alFiltrar={marcados.limpiar}
        />
      </Tarjeta>
    </section>
  );
}
