/** .view-head: título, línea de subtítulo (texto e insignias) y .toolbar a la derecha. */
export default function EncabezadoVista({ titulo, subtitulo, children }) {
  return (
    <div className="view-head">
      <div><h2>{titulo}</h2><p>{subtitulo}</p></div>
      {children && <div className="toolbar">{children}</div>}
    </div>
  );
}
