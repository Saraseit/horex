import BorradoMasivo from './BorradoMasivo.jsx';
import { useRecibos } from './useRecibos.js';

/**
 * Encabezado de las tablas de registros: fecha de pago (para los recibos), recibos de los marcados y,
 * para el supervisor, borrado de los marcados.
 */
export default function AccionesRegistros({ marcados, fechaPago, alCambiarFecha, puedeBorrar, alEliminar, eliminando }) {
  const { descargar, generando } = useRecibos();
  const n = marcados.length;
  return (
    <div className="toolbar">
      <label className="faint" htmlFor="fecha-pago" style={{ fontSize: 12 }}>Fecha de pago</label>
      <input id="fecha-pago" type="date" className="input sm" value={fechaPago} onChange={(e) => alCambiarFecha(e.target.value)} />
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        disabled={!n || generando}
        title={n ? undefined : 'Marca las casillas de los registros'}
        onClick={() => descargar(marcados, fechaPago)}
      >
        {generando ? 'Generando…' : `Recibos${n ? ` (${n})` : ''}`}
      </button>
      {puedeBorrar && <BorradoMasivo cantidad={n} ocupado={eliminando} alConfirmar={() => alEliminar(marcados.map((r) => r.id))} />}
    </div>
  );
}
