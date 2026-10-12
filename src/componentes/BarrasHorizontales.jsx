/**
 * .hbars / .hbar-row — filas: [{ clave, etiqueta, valor, texto, detalle }]
 * valor da el ancho de la barra; texto (y detalle en <small>) va a la derecha.
 */
export default function BarrasHorizontales({ filas, estiloFila, vacio }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="hbars">
      {filas.map((f) => (
        <div key={f.clave} className="hbar-row" style={estiloFila}>
          <span className="h-lbl">{f.etiqueta}</span>
          <div className="h-track"><div className="h-fill" style={{ width: `${(f.valor / max) * 100}%` }} /></div>
          <span className="h-val">{f.detalle && <small>{f.detalle}</small>}{f.texto}</span>
        </div>
      ))}
      {filas.length === 0 && vacio}
    </div>
  );
}
