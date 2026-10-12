/**
 * .card con encabezado opcional (título, subtítulo y acción a la derecha).
 * conCuerpo=false deja los hijos directo en la tarjeta (tablas a todo lo ancho).
 */
export default function Tarjeta({ titulo, subtitulo, accion, conCuerpo = true, claseCuerpo, estiloCuerpo, children }) {
  return (
    <div className="card">
      {titulo && (
        <div className="card-header">
          {subtitulo
            ? <div><div className="card-title">{titulo}</div><div className="card-subtitle">{subtitulo}</div></div>
            : <div className="card-title">{titulo}</div>}
          {accion}
        </div>
      )}
      {conCuerpo
        ? <div className={claseCuerpo ? `card-body ${claseCuerpo}` : 'card-body'} style={estiloCuerpo}>{children}</div>
        : children}
    </div>
  );
}
