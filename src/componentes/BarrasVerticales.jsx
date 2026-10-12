const ALTO_MAXIMO = 140;

/** .vbars — items: [{ clave, etiqueta, valor, actual }]; la barra actual va en --bar-2. */
export default function BarrasVerticales({ items, formato }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return (
    <>
      <div className="vbars">
        {items.map((i) => (
          <div key={i.clave} className={i.actual ? 'vbar current' : 'vbar'}>
            <span className="v-val">{formato(i.valor)}</span>
            <div className="v-col" style={{ height: `${Math.max(1, (i.valor / max) * ALTO_MAXIMO)}px` }} />
            <span className="v-lbl">{i.etiqueta}</span>
          </div>
        ))}
      </div>
      <div className="vbars-axis" />
    </>
  );
}
