import { useState } from 'react';

const unir = (...clases) => clases.filter(Boolean).join(' ') || undefined;
const valor = (v, fila) => (typeof v === 'function' ? v(fila) : v);
const comparar = (a, b) => (typeof a === 'string' || typeof b === 'string'
  ? String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true })
  : (a ?? 0) - (b ?? 0));

/**
 * .tbl-wrap + .tbl
 * columnas: [{ id, encabezado, tipo: 'num' | 'ctr', claseEncabezado, claseCelda, estiloCelda, celda: (fila) => nodo,
 *              orden: (fila) => número o texto }]
 * Las columnas con `orden` se ordenan con clic en su encabezado (ascendente, descendente, ascendente…).
 * Sin columna elegida, las filas quedan en el orden en que llegan.
 * pie: celdas <td> de la fila de totales. alClicFila convierte las filas en .clickable.
 * claseFila(fila) agrega clases a la fila (p. ej. "seleccionada").
 */
export default function Tabla({ columnas, filas, clave, pie, alClicFila, claseFila, estiloFila, vacio, estiloWrap, compacta }) {
  const [orden, setOrden] = useState(null);
  const columnaOrden = orden && columnas.find((c) => c.id === orden.id && c.orden);
  const visibles = columnaOrden
    ? [...filas].sort((a, b) => comparar(columnaOrden.orden(a), columnaOrden.orden(b)) * (orden.desc ? -1 : 1))
    : filas;
  const alternar = (c) => setOrden((o) => ({ id: c.id, desc: o?.id === c.id ? !o.desc : c.tipo === 'num' }));

  return (
    <div className="tbl-wrap" style={estiloWrap}>
      <table className={compacta ? 'tbl compacta' : 'tbl'}>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activa = columnaOrden?.id === c.id;
              return (
                <th
                  key={c.id} className={unir(c.tipo, c.claseEncabezado)}
                  aria-sort={activa ? (orden.desc ? 'descending' : 'ascending') : undefined}
                >
                  {c.orden ? (
                    <button type="button" className="th-orden" title="Ordenar" onClick={() => alternar(c)}>
                      {c.encabezado}{activa && <span className="th-flecha">{orden.desc ? '▼' : '▲'}</span>}
                    </button>
                  ) : c.encabezado}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibles.length === 0 && vacio}
          {visibles.map((f) => (
            <tr
              key={clave(f)}
              className={unir(alClicFila && 'clickable', claseFila?.(f))}
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
