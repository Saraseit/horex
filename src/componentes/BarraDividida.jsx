/** .split + .legend — partes: [{ etiqueta, valor, color }] (fijo y eventual). */
export default function BarraDividida({ partes, formato }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const pct = partes.map((p) => (total ? (p.valor / total) * 100 : 0));
  // Como la demo: con dos partes, la segunda es el complemento de la primera.
  if (pct.length === 2) pct[1] = 100 - pct[0];
  return (
    <>
      <div className="split">
        {partes.map((p, i) => <div key={p.etiqueta} style={{ width: `${pct[i]}%`, background: p.color }} />)}
      </div>
      <div className="legend">
        {partes.map((p, i) => (
          <span key={p.etiqueta}>
            <i style={{ background: p.color }} />{p.etiqueta} · <b className="mono">{formato(p.valor)}</b> ({pct[i].toFixed(0)}%)
          </span>
        ))}
      </div>
    </>
  );
}
