/** .kpi; hero = tarjeta destacada en --brand. */
export default function Kpi({ etiqueta, valor, sub, hero }) {
  return (
    <div className={hero ? 'kpi hero' : 'kpi'}>
      <div className="k-lbl">{etiqueta}</div>
      <div className="k-val">{valor}</div>
      <div className="k-sub">{sub}</div>
    </div>
  );
}
