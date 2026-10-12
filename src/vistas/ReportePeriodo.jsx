import { useNavigate, useSearchParams } from 'react-router-dom';
import BarraDividida from '../componentes/BarraDividida.jsx';
import BarrasHorizontales from '../componentes/BarrasHorizontales.jsx';
import BarrasVerticales from '../componentes/BarrasVerticales.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import FilaKpis from '../componentes/FilaKpis.jsx';
import Kpi from '../componentes/Kpi.jsx';
import Tabla from '../componentes/Tabla.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { useEmpleados, useRegistrosRango, useSemanasConDatos, useTipos } from '../datos/consultas.js';
import { barrasDelRango, domingos, porGrupo, porTipo, sumar, top } from '../logica/agregados.js';
import {
  anioDe, claveSemana, compararSemanas, desplazarSemana, etiquetaSemana, fechasDeSemanas, hoy, leerClaveSemana,
  mesAnterior, mismaSemana, nombreMes, semanaISO, semanasDelMes, semanasEntre, semanasParaElegir,
} from '../logica/fechas.js';
import { fechaCorta, fmtHoras, fmtMoneda, nombreCorto, plural } from '../logica/formato.js';
import { etiquetaTipo } from '../logica/reglas.js';

const CLAVE_VALIDA = /^\d{4}-\d{1,2}$/;
const menor = (a, b) => (compararSemanas(a, b) <= 0 ? a : b);

/**
 * Atajos, siempre en semanas completas de lunes a domingo. Un mes son las semanas que tienen su jueves
 * en ese mes (ninguna semana se parte entre dos meses).
 */
function atajos(hoyF, actual) {
  const anterior = semanasDelMes(mesAnterior(hoyF));
  const esteMes = semanasDelMes(hoyF);
  return [
    { etiqueta: 'Semana actual', desde: actual, hasta: actual },
    { etiqueta: 'Últimas 4 semanas', desde: desplazarSemana(actual, -3), hasta: actual },
    { etiqueta: nombreMes(mesAnterior(hoyF)), desde: anterior.desde, hasta: anterior.hasta },
    { etiqueta: nombreMes(hoyF), desde: menor(esteMes.desde, actual), hasta: menor(esteMes.hasta, actual) },
  ];
}

export default function ReportePeriodo() {
  const [busqueda, setBusqueda] = useSearchParams();
  const navegar = useNavigate();
  const hoyF = hoy();
  const actual = semanaISO(hoyF);
  const rapidos = atajos(hoyF, actual);
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

  const regs = registrosQ.data;
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
  const mejores = top(regs, 10);

  const fijarRango = (d, h) => setBusqueda({ desde: claveSemana(d), hasta: claveSemana(h) }, { replace: true });
  const cambiarDesde = (clave) => { const d = leerClaveSemana(clave); fijarRango(d, compararSemanas(d, hasta) > 0 ? d : hasta); };
  const cambiarHasta = (clave) => { const h = leerClaveSemana(clave); fijarRango(compararSemanas(h, desde) < 0 ? h : desde, h); };

  const columnasTop = [
    { id: 'n', encabezado: '#', claseCelda: 'mono faint', celda: (f) => mejores.indexOf(f) + 1 },
    { id: 'empleado', encabezado: 'Empleado', celda: (f) => nombreCorto(f.lista[0].nombre) },
    { id: 'grupo', encabezado: 'Grupo', celda: (f) => f.lista[0].grupo },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', celda: (f) => fmtHoras(f.horas) },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', celda: (f) => fmtMoneda(f.he) },
    { id: 'alim', encabezado: 'Alimentos', tipo: 'num', celda: (f) => fmtMoneda(f.alim) },
    { id: 'total', encabezado: 'Total', tipo: 'num', celda: (f) => <b>{fmtMoneda(f.total)}</b> },
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

      <FilaKpis>
        <Kpi etiqueta="Horas extra" valor={fmtHoras(s.horas)} sub={`${s.registros} registros`} />
        <Kpi etiqueta="Importe HE" valor={fmtMoneda(s.he)} sub={`Tarifa promedio ${s.horas ? fmtMoneda(s.he / s.horas) : '—'}/h`} />
        <Kpi etiqueta="Alimentos" valor={fmtMoneda(s.alim)} sub={`${s.comidas} comidas`} />
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

      <Tarjeta titulo="Top 10 empleados del período" subtitulo="Ordenado por total a pagar · clic para ver detalle" conCuerpo={false}>
        <Tabla columnas={columnasTop} filas={mejores} clave={(f) => f.empleado_id} alClicFila={(f) => navegar(`/reportes/empleado/${f.empleado_id}`)} />
      </Tarjeta>
    </section>
  );
}
