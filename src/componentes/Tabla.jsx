import { useEffect, useRef, useState } from 'react';

const unir = (...clases) => clases.filter(Boolean).join(' ') || undefined;
const valor = (v, fila) => (typeof v === 'function' ? v(fila) : v);
const comparar = (a, b) => (typeof a === 'string' || typeof b === 'string'
  ? String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true })
  : (a ?? 0) - (b ?? 0));
/** Texto con que una fila aparece en el filtro de esa columna (lo que se ve en la celda). */
const textoDe = (c, f) => String(c.texto ? c.texto(f) : c.orden(f) ?? '—');
const cumple = (filtros, columnas, f, excepto) => columnas.every((c) => {
  const permitidos = filtros[c.id];
  return !permitidos || c.id === excepto || permitidos.has(textoDe(c, f));
});

/**
 * .tbl-wrap + .tbl
 * columnas: [{ id, encabezado, tipo: 'num' | 'ctr', claseEncabezado, claseCelda, estiloCelda, celda: (fila) => nodo,
 *              orden: (fila) => número o texto, texto: (fila) => texto }]
 * Las columnas con `orden` tienen, como el autofiltro de Excel, un menú en el encabezado para ordenar y para
 * filtrar por los valores de la columna (`texto`, o el de `orden` si no hay). Clic en el nombre también ordena.
 * `encabezado` y `pie` pueden ser funciones de las filas visibles (después de filtrar).
 * alFiltrar(): se llama al cambiar un filtro (p. ej. para limpiar las casillas marcadas).
 * alClicFila convierte las filas en .clickable. claseFila(fila) agrega clases a la fila (p. ej. "seleccionada").
 */
export default function Tabla({ columnas, filas, clave, pie, alClicFila, claseFila, estiloFila, vacio, estiloWrap, compacta, alFiltrar }) {
  const [orden, setOrden] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [menu, setMenu] = useState(null); // { id, ancla: el botón ▾ }

  const filtradas = filas.filter((f) => cumple(filtros, columnas, f));
  const columnaOrden = orden && columnas.find((c) => c.id === orden.id && c.orden);
  const visibles = columnaOrden
    ? [...filtradas].sort((a, b) => comparar(columnaOrden.orden(a), columnaOrden.orden(b)) * (orden.desc ? -1 : 1))
    : filtradas;
  const alternar = (c) => setOrden((o) => ({ id: c.id, desc: o?.id === c.id ? !o.desc : c.tipo === 'num' }));
  const filtrar = (id, permitidos) => {
    setFiltros((actual) => {
      const nuevo = { ...actual };
      if (permitidos) nuevo[id] = permitidos; else delete nuevo[id];
      return nuevo;
    });
    alFiltrar?.();
  };
  const hayFiltros = Object.keys(filtros).length > 0;
  const columnaMenu = menu && columnas.find((c) => c.id === menu.id);

  return (
    <div className="tbl-wrap" style={estiloWrap}>
      <table className={compacta ? 'tbl compacta' : 'tbl'}>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activa = columnaOrden?.id === c.id;
              const filtrada = !!filtros[c.id];
              const nombre = typeof c.encabezado === 'string' ? c.encabezado : c.id;
              return (
                <th
                  key={c.id} className={unir(c.tipo, c.claseEncabezado)}
                  aria-sort={activa ? (orden.desc ? 'descending' : 'ascending') : undefined}
                >
                  {c.orden ? (
                    <span className="th-celda">
                      <button type="button" className="th-orden" title="Ordenar" onClick={() => alternar(c)}>
                        {c.encabezado}{activa && <span className="th-flecha">{orden.desc ? '▼' : '▲'}</span>}
                      </button>
                      <button
                        type="button" className={filtrada ? 'th-filtro activo' : 'th-filtro'}
                        aria-label={`Filtrar ${nombre}`} aria-haspopup="dialog" aria-expanded={menu?.id === c.id}
                        title={filtrada ? 'Filtro activo' : 'Ordenar y filtrar'}
                        onClick={(e) => setMenu(menu?.id === c.id ? null : { id: c.id, ancla: e.currentTarget })}
                      >
                        {filtrada ? '⧩' : '▾'}
                      </button>
                    </span>
                  ) : valor(c.encabezado, visibles)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibles.length === 0 && (hayFiltros
            ? <tr><td colSpan={columnas.length} className="faint">Ningún registro con estos filtros</td></tr>
            : vacio)}
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
        {pie && <tfoot><tr>{valor(pie, visibles)}</tr></tfoot>}
      </table>
      {columnaMenu && (
        <MenuFiltro
          key={columnaMenu.id}
          columna={columnaMenu}
          ancla={menu.ancla}
          // Como Excel: los valores que dejan los filtros de las otras columnas.
          filas={filas.filter((f) => cumple(filtros, columnas, f, columnaMenu.id))}
          permitidos={filtros[columnaMenu.id]}
          alOrdenar={(desc) => { setOrden({ id: columnaMenu.id, desc }); setMenu(null); }}
          alAplicar={(permitidos) => { filtrar(columnaMenu.id, permitidos); setMenu(null); }}
          alCerrar={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/** Menú de una columna: ordenar, buscar y elegir los valores que se muestran. */
function MenuFiltro({ columna, ancla, filas, permitidos, alOrdenar, alAplicar, alCerrar }) {
  const caja = useRef(null);
  // Fijo bajo su botón: al desplazar la página o cambiar el tamaño, el menú lo sigue.
  const [rect, setRect] = useState(() => ancla.getBoundingClientRect());
  const [buscar, setBuscar] = useState('');
  // Valores distintos de la columna, en el orden de la columna.
  const porTexto = new Map();
  for (const f of filas) {
    const t = textoDe(columna, f);
    const o = columna.orden(f);
    if (!porTexto.has(t) || comparar(o, porTexto.get(t)) < 0) porTexto.set(t, o);
  }
  const valores = [...porTexto.entries()].sort((a, b) => comparar(a[1], b[1])).map(([t]) => t);
  const [marcados, setMarcados] = useState(() => new Set(permitidos ?? valores));
  const texto = buscar.trim().toLowerCase();
  const mostrados = texto ? valores.filter((v) => v.toLowerCase().includes(texto)) : valores;
  const todosMostrados = mostrados.length > 0 && mostrados.every((v) => marcados.has(v));
  const numerica = columna.tipo === 'num';

  useEffect(() => {
    const fuera = (e) => { if (!caja.current?.contains(e.target)) alCerrar(); };
    const tecla = (e) => { if (e.key === 'Escape') alCerrar(); };
    const seguir = () => setRect(ancla.getBoundingClientRect());
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', seguir);
    window.addEventListener('scroll', seguir, true);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', seguir);
      window.removeEventListener('scroll', seguir, true);
    };
  }, [alCerrar, ancla]);

  const alternar = (v) => setMarcados((m) => {
    const nuevo = new Set(m);
    if (nuevo.has(v)) nuevo.delete(v); else nuevo.add(v);
    return nuevo;
  });
  const alternarMostrados = () => setMarcados((m) => {
    const nuevo = new Set(m);
    mostrados.forEach((v) => (todosMostrados ? nuevo.delete(v) : nuevo.add(v)));
    return nuevo;
  });
  // Con buscador, como Excel: se aplican sólo los valores encontrados que estén marcados.
  const elegidos = texto ? mostrados.filter((v) => marcados.has(v)) : valores.filter((v) => marcados.has(v));
  const aplicar = () => alAplicar(elegidos.length === valores.length ? null : new Set(elegidos));

  const ancho = 250;
  const estilo = {
    top: Math.min(rect.bottom + 4, window.innerHeight - 380),
    left: Math.max(8, Math.min(rect.right - ancho, window.innerWidth - ancho - 8)),
    width: ancho,
  };

  return (
    <div ref={caja} className="menu-filtro" role="dialog" aria-label={`Filtrar ${columna.encabezado}`} style={estilo}>
      <button type="button" className="menu-filtro-orden" onClick={() => alOrdenar(false)}>
        {numerica ? 'Ordenar de menor a mayor' : 'Ordenar de la A a la Z'}
      </button>
      <button type="button" className="menu-filtro-orden" onClick={() => alOrdenar(true)}>
        {numerica ? 'Ordenar de mayor a menor' : 'Ordenar de la Z a la A'}
      </button>
      <input
        className="input sm" type="search" placeholder="Buscar…" aria-label="Buscar valor"
        value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && elegidos.length) aplicar(); }}
      />
      <div className="menu-filtro-lista">
        <label className="menu-filtro-valor todos">
          <input type="checkbox" className="casilla" checked={todosMostrados} onChange={alternarMostrados} />
          {texto ? 'Seleccionar los encontrados' : 'Seleccionar todo'}
        </label>
        {mostrados.map((v) => (
          <label key={v} className="menu-filtro-valor">
            <input type="checkbox" className="casilla" checked={marcados.has(v)} onChange={() => alternar(v)} />
            {v}
          </label>
        ))}
        {!mostrados.length && <div className="faint menu-filtro-valor">Sin coincidencias</div>}
      </div>
      <div className="menu-filtro-acciones">
        {permitidos && <button type="button" className="btn btn-ghost btn-xs" onClick={() => alAplicar(null)}>Quitar filtro</button>}
        <button type="button" className="btn btn-ghost btn-xs" onClick={alCerrar}>Cancelar</button>
        <button type="button" className="btn btn-brand btn-xs" disabled={!elegidos.length} onClick={aplicar}>Aceptar</button>
      </div>
    </div>
  );
}
