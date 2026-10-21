import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BarraDividida from '../componentes/BarraDividida.jsx';
import BarrasHorizontales from '../componentes/BarrasHorizontales.jsx';
import BarrasVerticales from '../componentes/BarrasVerticales.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import FilaKpis from '../componentes/FilaKpis.jsx';
import Filtros from '../componentes/Filtros.jsx';
import Kpi from '../componentes/Kpi.jsx';
import MontoComida from '../componentes/MontoComida.jsx';
import Tabla from '../componentes/Tabla.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { useEmpleados, useRegistrosRango, useSemanasConDatos, useTipos } from '../datos/consultas.js';
import { barrasDelRango, domingos, porGrupo, porTipo, sumar, top } from '../logica/agregados.js';
import { FILTROS_VACIOS, filtrarRegistros } from '../logica/filtros.js';
import {
  anioDe, claveSemana, compararSemanas, desplazarSemana, etiquetaSemana, fechasDeSemanas, leerClaveSemana,
  diasDeSemana, mesAnterior, mismaSemana, nombreMes, semanaCaptura, semanasDelMes, semanasEntre, semanasParaElegir,
} from '../logica/fechas.js';
import { fechaCorta, fmtHoras, fmtMoneda, nombreCorto, plural, resumenComidas } from '../logica/formato.js';
import { COMIDAS, etiquetaTipo } from '../logica/reglas.js';

const CLAVE_VALIDA = /^\d{4}-\d{1,2}$/;
const menor = (a, b) => (compararSemanas(a, b) <= 0 ? a : b);

/**
 * Atajos, siempre en semanas completas de lunes a domingo. Un mes son las semanas que tienen su jueves
 * en ese mes (ninguna semana se parte entre dos meses).
 */
function atajos(fechaRef, actual) {
  const anterior = semanasDelMes(mesAnterior(fechaRef));
  const esteMes = semanasDelMes(fechaRef);
  return [
    { etiqueta: 'Semana actual', desde: actual, hasta: actual },
    { etiqueta: 'Últimas 4 semanas', desde: desplazarSemana(actual, -3), hasta: actual },
    { etiqueta: nombreMes(mesAnterior(fechaRef)), desde: anterior.desde, hasta: anterior.hasta },
    { etiqueta: nombreMes(fechaRef), desde: menor(esteMes.desde, actual), hasta: menor(esteMes.hasta, actual) },
  ];
}

export default function ReportePeriodo() {
  const [busqueda, setBusqueda] = useSearchParams();
  const navegar = useNavigate();
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  // Todo se mide desde la semana en captura (la pasada); los meses, desde su jueves.
  const actual = semanaCaptura();
  const rapidos = atajos(diasDeSemana(actual.anio, actual.semana)[3], actual);
  const leer = (k, defecto) => (CLAVE_VALIDA.test(busqueda.get(k) ?? '') ? menor(leerClaveSemana(busqueda.get(k)), actual) : defecto);
  let desde = leer('desde', rapidos[1].desde);
  let hasta = leer('hasta', rapidos[1].hasta);
  if (compararSemanas(desde, hasta) > 0) [desde, hasta] = [hasta, desde];
  const fechas = fechasDeSemanas(desde, hasta);

  const registrosQ = useRegistrosRango(fechas.desde, fechas.hasta);
  const semanasQ = useSemanasConDatos();
  const empleadosQ = useEmpleados();
  const tiposQ = useTipos();
  const consultas = [registrosQ, semanasQ, empleadosQ, tiposQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;

  // Los filtros aplican a todo el reporte.
  const regs = filtrarRegistros(registrosQ.data, filtros);
  const tipos = tiposQ.data;
  const empleadosPorId = new Map(empleadosQ.data.map((e) => [e.id, e]));
  const semanas = semanasEntre(desde, hasta);
  const opciones = semanasParaElegir(semanasQ.data, actual, desde, hasta);
  const s = sumar(regs);
  const barras = barrasDelRango(regs, semanas, actual);
  const grupos = porGrupo(regs, empleadosPorId);
  const dom = sumar(domingos(regs));
  const ordenTipos = [...tipos.map((t) => t.clave), null];
  const desglose = porTipo(regs)
    .sort((a, b) => ordenTipos.indexOf(a.clave) - ordenTipos.indexOf(b.clave))
    .sort((a, b) => b.total - a.total);
  // Todos los empleados del período, del que más cobra al que menos (el # es esa posición).
  const empleados = top(regs, Infinity);

  const fijarRango = (d, h) => setBusqueda({ desde: claveSemana(d), hasta: claveSemana(h) }, { replace: true });
  const cambiarDesde = (clave) => { const d = leerClaveSemana(clave); fijarRango(d, compararSemanas(d, hasta) > 0 ? d : hasta); };
  const cambiarHasta = (clave) => { const h = leerClaveSemana(clave); fijarRango(compararSemanas(h, desde) < 0 ? h : desde, h); };

  const columnasTop = [
    { id: 'n', encabezado: '#', claseCelda: 'mono faint', orden: (f) => empleados.indexOf(f), celda: (f) => empleados.indexOf(f) + 1 },
    { id: 'empleado', encabezado: 'Empleado', orden: (f) => f.lista[0].nombre, celda: (f) => nombreCorto(f.lista[0].nombre) },
    { id: 'grupo', encabezado: 'Grupo', orden: (f) => f.lista[0].grupo, celda: (f) => f.lista[0].grupo },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', orden: (f) => f.horas, celda: (f) => fmtHoras(f.horas) },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', orden: (f) => f.he, celda: (f) => fmtMoneda(f.he) },
    ...COMIDAS.map((c) => ({
      id: c.clave, encabezado: c.etiqueta, tipo: 'num', orden: (f) => f[c.importe],
      celda: (f) => <MontoComida monto={f[c.importe]} cantidad={f[c.cantidad]} />,
    })),
    { id: 'total', encabezado: 'Total', tipo: 'num', orden: (f) => f.total, celda: (f) => <b>{fmtMoneda(f.total)}</b> },
  ];
  const selectorSemana = (id, etiqueta, valor, alCambiar) => (
    <select className="select sm" id={id} aria-label={etiqueta} value={claveSemana(valor)} onChange={(e) => alCambiar(e.target.value)}>
      {opciones.map((o) => <option key={claveSemana(o)} value={claveSemana(o)}>{etiquetaSemana(o, actual)}</option>)}
    </select>
  );

  return (
    <section className="view">
      <EncabezadoVista
        titulo="Reporte por período"
        subtitulo={`${fechaCorta(fechas.desde)} – ${fechaCorta(fechas.hasta)} ${anioDe(fechas.hasta)} · ${semanas.length} ${plural(semanas.length, 'semana')}`}
      >
        <div className="seg">
          {rapidos.map((r) => {
            const activo = mismaSemana(r.desde, desde) && mismaSemana(r.hasta, hasta);
            return (
              <button key={r.etiqueta} type="button" className={activo ? 'on' : undefined} aria-pressed={activo} onClick={() => fijarRango(r.desde, r.hasta)}>
                {r.etiqueta}
              </button>
            );
          })}
        </div>
        {selectorSemana('per-desde', 'Desde la semana', desde, cambiarDesde)}
        <span className="faint">a</span>
        {selectorSemana('per-hasta', 'Hasta la semana', hasta, cambiarHasta)}
      </EncabezadoVista>

      <Filtros valor={filtros} alCambiar={setFiltros} tipos={tipos} total={registrosQ.data.length} visibles={regs.length} />

      <FilaKpis>
        <Kpi etiqueta="Horas extra" valor={fmtHoras(s.horas)} sub={`${s.registros} registros`} />
        <Kpi etiqueta="Importe HE" valor={fmtMoneda(s.he)} sub={`Tarifa promedio ${s.horas ? fmtMoneda(s.he / s.horas) : '—'}/h`} />
        <Kpi etiqueta="Alimentos" valor={fmtMoneda(s.alim)} sub={resumenComidas(s)} />
        <Kpi etiqueta="Total del período" valor={fmtMoneda(s.total)} sub={`Domingos: ${fmtMoneda(dom.total)}`} hero />
      </FilaKpis>

      <div className="grid-2">
        <Tarjeta
          titulo={barras.porMes ? 'Total por mes' : 'Total por semana'}
          subtitulo={barras.porMes ? 'HE + alimentos · cada semana cuenta en el mes de su jueves' : 'HE + alimentos'}
        >
          {regs.length ? <BarrasVerticales items={barras.items} formato={fmtMoneda} /> : <div className="empty-state">Sin datos</div>}
        </Tarjeta>
        <Tarjeta titulo="Personal fijo vs eventual" subtitulo="Participación en el total">
          <BarraDividida
            partes={[
              { etiqueta: 'P. Fijo', valor: grupos.fijo.total, color: 'var(--bar)' },
              { etiqueta: 'Eventual', valor: grupos.eventual.total, color: 'var(--bar-2)' },
            ]}
            formato={fmtMoneda}
          />
          <div className="rule-list" style={{ marginTop: 14 }}>
            <div className="rule"><span>Horas personal fijo</span><b>{fmtHoras(grupos.fijo.horas)}</b></div>
            <div className="rule"><span>Horas personal eventual</span><b>{fmtHoras(grupos.eventual.horas)}</b></div>
            <div className="rule"><span>Horas en domingo</span><b>{fmtHoras(dom.horas)}</b></div>
          </div>
        </Tarjeta>
      </div>

      <div className="grid-3-1">
        <Tarjeta titulo="Desglose por tipo de hora" subtitulo="Total por tipo (HE + alimentos del registro)">
          <BarrasHorizontales
            filas={desglose.map((t) => ({
              clave: t.clave ?? 'solo-alimentos',
              etiqueta: etiquetaTipo(t.clave, tipos),
              valor: t.total,
              detalle: t.horas ? fmtHoras(t.horas) : `${t.registros} reg.`,
              texto: fmtMoneda(t.total),
            }))}
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

      <Tarjeta titulo="Empleados del período" subtitulo="Del que más cobra al que menos · clic en un encabezado para ordenar, en una fila para ver el detalle" conCuerpo={false}>
        <Tabla
          columnas={columnasTop} filas={empleados} clave={(f) => f.empleado_id}
          vacio={<tr><td colSpan={columnasTop.length} className="faint">Sin registros en el período</td></tr>}
          alClicFila={(f) => navegar(`/reportes/empleado/${f.empleado_id}`)}
        />
      </Tarjeta>
    </section>
  );
}
