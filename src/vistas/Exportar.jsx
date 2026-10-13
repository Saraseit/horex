import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Cargando from '../componentes/Cargando.jsx';
import { descargarArchivo } from '../componentes/descargar.js';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import Segmentado from '../componentes/Segmentado.jsx';
import { useToast } from '../componentes/useToast.js';
import { useEmpleados, useRegistrosRango, useSemanasConDatos, useTipos } from '../datos/consultas.js';
import { FORMATOS_EXPORTACION, aCSV, aTSV, aXLSX, datosExport, nombreArchivo } from '../logica/exportar.js';
import {
  claveSemana, compararSemanas, etiquetaSemana, fechasDeSemanas, leerClaveSemana, semanaCaptura, semanasParaElegir,
} from '../logica/fechas.js';
import { fmtMoneda, plural } from '../logica/formato.js';

const FILAS_VISTA_PREVIA = 40;
const CLAVE_VALIDA = /^\d{4}-\d{1,2}$/;

export default function Exportar() {
  const toast = useToast();
  const [busqueda, setBusqueda] = useSearchParams();
  const [respaldoCopia, setRespaldoCopia] = useState(null);
  const [generando, setGenerando] = useState(false);
  const actual = semanaCaptura();
  const leer = (k) => (CLAVE_VALIDA.test(busqueda.get(k) ?? '') ? leerClaveSemana(busqueda.get(k)) : actual);
  const desde = leer('desde');
  const hasta = leer('hasta');
  const formato = FORMATOS_EXPORTACION.some((f) => f.valor === busqueda.get('formato')) ? busqueda.get('formato') : 'resumen';

  const fechas = fechasDeSemanas(desde, hasta);
  const registrosQ = useRegistrosRango(fechas.desde, fechas.hasta);
  const semanasQ = useSemanasConDatos();
  const empleadosQ = useEmpleados();
  const tiposQ = useTipos();
  const consultas = [registrosQ, semanasQ, empleadosQ, tiposQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;

  const opciones = semanasParaElegir(semanasQ.data, actual, desde, hasta);
  const d = datosExport({ registros: registrosQ.data, empleados: empleadosQ.data, tipos: tiposQ.data, formato });
  const vistaPrevia = d.filas.slice(0, FILAS_VISTA_PREVIA);
  const archivo = (extension) => nombreArchivo({ desde, hasta, formato, extension });

  const cambiar = (cambios) => {
    const nueva = new URLSearchParams(busqueda);
    Object.entries(cambios).forEach(([k, v]) => nueva.set(k, v));
    setBusqueda(nueva, { replace: true });
    setRespaldoCopia(null);
  };
  const cambiarDesde = (clave) => {
    const nuevo = leerClaveSemana(clave);
    cambiar({ desde: clave, ...(compararSemanas(hasta, nuevo) < 0 && { hasta: clave }) });
  };
  const cambiarHasta = (clave) => {
    const nuevo = leerClaveSemana(clave);
    cambiar({ hasta: clave, ...(compararSemanas(desde, nuevo) > 0 && { desde: clave }) });
  };

  async function descargarXLSX() {
    setGenerando(true);
    try {
      descargarArchivo(await aXLSX(d), archivo('xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
      toast(`No se pudo generar el .xlsx: ${e.message}`);
    } finally {
      setGenerando(false);
    }
  }

  function copiar() {
    const texto = aTSV(d);
    const respaldo = () => setRespaldoCopia(texto);
    try {
      navigator.clipboard.writeText(texto).then(() => toast(`Copiadas ${d.filas.length} filas — pégalas en Excel`)).catch(respaldo);
    } catch {
      respaldo();
    }
  }

  const celda = (v, i) => (d.numericas.includes(i)
    ? <td key={i} className="num">{d.moneda.includes(i) ? fmtMoneda(v) : v}</td>
    : <td key={i}>{v}</td>);
  const semanasTexto = `Semanas ${desde.semana}${claveSemana(hasta) !== claveSemana(desde) ? `–${hasta.semana}` : ''}`;

  return (
    <section className="view">
      <EncabezadoVista titulo="Exportar para nómina" subtitulo="Genera la tabla que hoy se arma a mano en la hoja REPORTE" />
      <div className="card">
        <div className="card-body" style={{ paddingTop: 18 }}>
          <div className="toolbar" style={{ gap: 16, alignItems: 'flex-end' }}>
            <div className="field">
              <label className="label" htmlFor="exp-desde">Desde</label>
              <select className="select sm" id="exp-desde" value={claveSemana(desde)} onChange={(e) => cambiarDesde(e.target.value)}>
                {opciones.map((o) => <option key={claveSemana(o)} value={claveSemana(o)}>{etiquetaSemana(o, actual)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="exp-hasta">Hasta</label>
              <select className="select sm" id="exp-hasta" value={claveSemana(hasta)} onChange={(e) => cambiarHasta(e.target.value)}>
                {opciones.map((o) => <option key={claveSemana(o)} value={claveSemana(o)}>{etiquetaSemana(o, actual)}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="label">Formato</span>
              <Segmentado opciones={FORMATOS_EXPORTACION} valor={formato} alCambiar={(v) => cambiar({ formato: v })} />
            </div>
            <div style={{ marginLeft: 'auto' }} className="toolbar">
              <button type="button" className="btn btn-primary" onClick={descargarXLSX} disabled={generando}>Descargar .xlsx</button>
              <button type="button" className="btn btn-ghost" onClick={() => descargarArchivo(aCSV(d), archivo('csv'), 'text/csv;charset=utf-8')}>Descargar .csv</button>
              <button type="button" className="btn btn-ghost" onClick={copiar}>Copiar tabla para Excel</button>
            </div>
          </div>
          {respaldoCopia !== null && (
            <>
              <textarea
                className="copy-fallback" readOnly value={respaldoCopia} aria-label="Tabla para copiar"
                ref={(el) => { if (el) { el.focus(); el.select(); } }}
              />
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>El portapapeles no está disponible aquí: selecciona el texto y cópialo con Ctrl+C.</div>
            </>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Vista previa</div>
            <div className="card-subtitle">
              {d.filas.length} {plural(d.filas.length, 'fila')}
              {d.filas.length > vistaPrevia.length ? ` · mostrando las primeras ${vistaPrevia.length}` : ''} · {semanasTexto}
            </div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{d.encabezados.map((h, i) => <th key={h} className={d.numericas.includes(i) ? 'num' : undefined}>{h}</th>)}</tr></thead>
            <tbody>{vistaPrevia.map((f, n) => <tr key={n}>{f.map(celda)}</tr>)}</tbody>
            {d.pie && <tfoot><tr>{d.pie.map((v, i) => (v === '' ? <td key={i} /> : celda(v, i)))}</tr></tfoot>}
          </table>
        </div>
      </div>
    </section>
  );
}
