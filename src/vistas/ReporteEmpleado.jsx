import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alimentos from '../componentes/Alimentos.jsx';
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
import { useConteos, useEmpleados, useRegistrosEmpleado, useTipos } from '../datos/consultas.js';
import { agrupar, domingos, porTipo, sumar } from '../logica/agregados.js';
import {
  anioDe, claveSemana, desplazarSemana, hoy, lunesDeSemana, mesCorto, mismaSemana, semanaISO, semanasEntre,
} from '../logica/fechas.js';
import { fechaLarga, fmtHoras, fmtMoneda, fmtTarifa, siNo } from '../logica/formato.js';
import { etiquetaTipo } from '../logica/reglas.js';

const RANGOS = [
  { valor: '4', etiqueta: 'Últimas 4 semanas' },
  { valor: '8', etiqueta: '8 semanas' },
  { valor: 'anio', etiqueta: 'Este año' },
];

/** Fechas y semanas que cubre cada opción de rango. */
function calcularRango(rango, hoyF) {
  const actual = semanaISO(hoyF);
  if (rango === 'anio') {
    const desde = `${anioDe(hoyF)}-01-01`;
    return { desde, semanas: semanasEntre(semanaISO(desde), actual), descripcion: `Año ${anioDe(hoyF)}` };
  }
  const semanas = semanasEntre(desplazarSemana(actual, rango === '8' ? -7 : -3), actual);
  return {
    desde: lunesDeSemana(semanas[0].anio, semanas[0].semana),
    semanas,
    descripcion: `Semanas ${semanas[0].semana}–${actual.semana}`,
  };
}

export default function ReporteEmpleado() {
  const { id } = useParams();
  const [busqueda, setBusqueda] = useSearchParams();
  const navegar = useNavigate();
  const rango = RANGOS.some((r) => r.valor === busqueda.get('rango')) ? busqueda.get('rango') : '4';
  const hoyF = hoy();
  const actual = semanaISO(hoyF);
  const { desde, semanas, descripcion } = calcularRango(rango, hoyF);

  const empleadosQ = useEmpleados();
  const conteosQ = useConteos();
  const tiposQ = useTipos();
  const conRegistros = (empleadosQ.data ?? [])
    .filter((e) => conteosQ.data?.porEmpleado[e.id] > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const empleadoId = id ? Number(id) : conRegistros[0]?.id;
  const registrosQ = useRegistrosEmpleado(empleadoId, desde, hoyF);

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

  let barras;
  if (rango === 'anio') {
    const porMes = agrupar(regs, (r) => r.fecha.slice(0, 7));
    const meses = Array.from({ length: Number(hoyF.slice(5, 7)) }, (_, i) => `${anioDe(hoyF)}-${String(i + 1).padStart(2, '0')}`);
    barras = meses.map((m) => ({
      clave: m, etiqueta: mesCorto(`${m}-01`), valor: sumar(porMes.get(m) ?? []).total, actual: m === hoyF.slice(0, 7),
    }));
  } else {
    const porSem = agrupar(regs, (r) => claveSemana({ anio: r.anio_iso, semana: r.semana }));
    barras = semanas.map((w) => ({
      clave: claveSemana(w), etiqueta: `Sem ${w.semana}`, valor: sumar(porSem.get(claveSemana(w)) ?? []).total, actual: mismaSemana(w, actual),
    }));
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

  const columnas = [
    { id: 'sem', encabezado: 'Sem.', claseCelda: 'mono faint', celda: (r) => r.semana },
    { id: 'fecha', encabezado: 'Fecha', celda: (r) => fechaLarga(r.fecha) },
    { id: 'tipo', encabezado: 'Tipo', celda: (r) => <PildoraTipo clave={r.tipo_clave} etiqueta={r.tipo_etiqueta} /> },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', celda: (r) => r.horas || '—' },
    { id: 'tarifa', encabezado: 'Tarifa', tipo: 'num', celda: (r) => (r.tarifa_aplicada ? fmtTarifa(r.tarifa_aplicada) : '—') },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', celda: (r) => fmtMoneda(r.importe_he) },
    { id: 'alim', encabezado: 'Alim.', tipo: 'ctr', celda: (r) => <Alimentos registro={r} /> },
    { id: 'total', encabezado: 'Total', tipo: 'num', celda: (r) => <b>{fmtMoneda(r.total)}</b> },
  ];

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
          titulo={rango === 'anio' ? 'Total por mes' : 'Total por semana'}
          subtitulo={rango === 'anio' ? 'HE + alimentos · mes actual en ámbar' : 'HE + alimentos · semana actual en ámbar'}
        >
          <BarrasVerticales items={barras} formato={fmtMoneda} />
        </Tarjeta>
        <Tarjeta titulo="Horas por tipo">
          <BarrasHorizontales
            filas={horasPorTipo}
            estiloFila={{ gridTemplateColumns: '110px 1fr auto' }}
            vacio={<div className="faint">Sin horas extra (solo alimentos)</div>}
          />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Historial de registros" conCuerpo={false}>
        <Tabla
          columnas={columnas}
          filas={regs}
          clave={(r) => r.id}
          pie={<>
            <td colSpan={3}>Total</td>
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
