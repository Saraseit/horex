const unir = (...clases) => clases.filter(Boolean).join(' ') || undefined;
const valor = (v, fila) => (typeof v === 'function' ? v(fila) : v);

/**
 * .tbl-wrap + .tbl
 * columnas: [{ id, encabezado, tipo: 'num' | 'ctr', claseEncabezado, claseCelda, estiloCelda, celda: (fila) => nodo }]
 * pie: celdas <td> de la fila de totales. alClicFila convierte las filas en .clickable.
 */
export default function Tabla({ columnas, filas, clave, pie, alClicFila, estiloFila, vacio, estiloWrap }) {
  return (
    <div className="tbl-wrap" style={estiloWrap}>
      <table className="tbl">
        <thead>
          <tr>{columnas.map((c) => <th key={c.id} className={unir(c.tipo, c.claseEncabezado)}>{c.encabezado}</th>)}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && vacio}
          {filas.map((f) => (
            <tr
              key={clave(f)}
              className={alClicFila ? 'clickable' : undefined}
              onClick={alClicFila ? () => alClicFila(f) : undefined}
              style={estiloFila?.(f)}
            >
              {columnas.map((c) => (
                <td key={c.id} className={unir(c.tipo, valor(c.claseCelda, f))} style={valor(c.estiloCelda, f)}>
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie && <tfoot><tr>{pie}</tr></tfoot>}
      </table>
    </div>
  );
}
