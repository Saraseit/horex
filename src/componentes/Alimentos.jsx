/** .meals: D / A / C según los alimentos del registro. */
export default function Alimentos({ registro }) {
  const m = [];
  if (registro.desayuno) m.push(<span key="d" title="Desayuno">D</span>);
  if (registro.almuerzo) m.push(<span key="a" title="Almuerzo">A</span>);
  if (registro.cena) m.push(<span key="c" title="Cena">C</span>);
  return m.length ? <span className="meals">{m}</span> : <span className="faint">—</span>;
}
