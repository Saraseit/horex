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
import { useEmpleados, useRegistrosRango, useTipos } from '../datos/consultas.js';
import { domingos, porGrupo, porSemana, porTipo, sumar, top } from '../logica/agregados.js';
import {
  anioDe, desplazarSemana, finDeMes, hoy, inicioDeMes, lunesDeSemana, mesAnterior, mismaSemana, nombreMes, semanaISO,
} from '../logica/fechas.js';
import { fechaCorta, fmtHoras, fmtMoneda, nombreCorto, plural } from '../logica/formato.js';
import { etiquetaTipo } from '../logica/reglas.js';

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function atajos(hoyF) {
  const actual = semanaISO(hoyF);
  const hace3 = desplazarSemana(actual, -3);
  const anterior = mesAnterior(hoyF);
  return [
    { etiqueta: 'Semana actual', desde: lunesDeSemana(actual.anio, actual.semana), hasta: hoyF },
    { etiqueta: 'Últimas 4 semanas', desde: lunesDeSemana(hace3.anio, hace3.semana), hasta: hoyF },
    { etiqueta: nombreMes(anterior), desde: anterior, hasta: finDeMes(anterior) },
    { etiqueta: nombreMes(hoyF), desde: inicioDeMes(hoyF), hasta: hoyF },
  ];
}

export default function ReportePeriodo() {
  const [busqueda, setBusqueda] = useSearchParams();
  const navegar = useNavigate();
  const hoyF = hoy();
  const rapidos = atajos(hoyF);
  const leer = (k, defecto) => (FECHA_VALIDA.test(busqueda.get(k) ?? '') ? busqueda.get(k) : defecto);
  const desde = leer('desde', rapidos[1].desde);
  const hasta = leer('hasta', rapidos[1].hasta);

  const registrosQ = useRegistrosRango(desde, hasta);
  const empleadosQ = useEmpleados();
  const tiposQ = useTipos();
  const consultas = [registrosQ, empleadosQ, tiposQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;

  const regs = registrosQ.data;
  const tipos = tiposQ.data;
  const empleadosPorId = new Map(empleadosQ.data.map((e) => [e.id, e]));
  const actual = semanaISO(hoyF);
  const s = sumar(regs);
  const semanas = porSemana(regs);
  const grupos = porGrupo(regs, empleadosPorId);
  const dom = sumar(domingos(regs));
  const ordenTipos = [...tipos.map((t) => t.clave), null];
  const desglose = porTipo(regs)
    .sort((a, b) => ordenTipos.indexOf(a.clave) - ordenTipos.indexOf(b.clave))
    .sort((a, b) => b.total - a.total);
  const mejores = top(regs, 10);

  const fijarRango = (d, h) => setBusqueda({ desde: d, hasta: h }, { replace: true });
  const cambiarDesde = (v) => { if (FECHA_VALIDA.test(v)) fijarRango(v, v > hasta ? v : hasta); };
  const cambiarHasta = (v) => { if (FECHA_VALIDA.test(v)) fijarRango(v < desde ? v : desde, v); };

  const columnasTop = [
    { id: 'n', encabezado: '#', claseCelda: 'mono faint', celda: (f) => mejores.indexOf(f) + 1 },
    { id: 'empleado', encabezado: 'Empleado', celda: (f) => nombreCorto(f.lista[0].nombre) },
    { id: 'grupo', encabezado: 'Grupo', celda: (f) => f.lista[0].grupo },
    { id: 'horas', encabezado: 'Horas', tipo: 'num', celda: (f) => fmtHoras(f.horas) },
    { id: 'he', encabezado: 'Importe HE', tipo: 'num', celda: (f) => fmtMoneda(f.he) },
    { id: 'alim', encabezado: 'Alimentos', tipo: 'num', celda: (f) => fmtMoneda(f.alim) },
    { id: 'total', encabezado: 'Total', tipo: 'num', celda: (f) => <b>{fmtMoneda(f.total)}</b> },
  ];

  return (
    <section className="view">
      <EncabezadoVista
        titulo="Reporte por período"
        subtitulo={`${fechaCorta(desde)} – ${fechaCorta(hasta)} ${anioDe(hasta)} · ${semanas.length} ${plural(semanas.length, 'semana')}`}
      >
        <div className="seg">
          {rapidos.map((r) => {
            const activo = r.desde === desde && r.hasta === hasta;
            return (
              <button key={r.etiqueta} type="button" className={activo ? 'on' : undefined} aria-pressed={activo} onClick={() => fijarRango(r.desde, r.hasta)}>
                {r.etiqueta}
              </button>
            );
          })}
        </div>
        <input type="date" className="input sm" id="per-desde" aria-label="Desde" value={desde} max={hoyF} onChange={(e) => cambiarDesde(e.target.value)} />
        <span className="faint">a</span>
        <input type="date" className="input sm" id="per-hasta" aria-label="Hasta" value={hasta} max={hoyF} onChange={(e) => cambiarHasta(e.target.value)} />
      </EncabezadoVista>

      <FilaKpis>
        <Kpi etiqueta="Horas extra" valor={fmtHoras(s.horas)} sub={`${s.registros} registros`} />
        <Kpi etiqueta="Importe HE" valor={fmtMoneda(s.he)} sub={`Tarifa promedio ${s.horas ? fmtMoneda(s.he / s.horas) : '—'}/h`} />
        <Kpi etiqueta="Alimentos" valor={fmtMoneda(s.alim)} sub={`${s.comidas} comidas`} />
        <Kpi etiqueta="Total del período" valor={fmtMoneda(s.total)} sub={`Domingos: ${fmtMoneda(dom.total)}`} hero />
      </FilaKpis>

      <div className="grid-2">
        <Tarjeta titulo="Total por semana" subtitulo="HE + alimentos">
          {semanas.length ? (
            <BarrasVerticales
              items={semanas.map((w) => ({ clave: `${w.anio}-${w.semana}`, etiqueta: `Sem ${w.semana}`, valor: w.total, actual: mismaSemana(w, actual) }))}
              formato={fmtMoneda}
            />
          ) : <div className="empty-state">Sin datos</div>}
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
