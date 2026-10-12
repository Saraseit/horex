/** .seg — opciones: [{ valor, etiqueta }] */
export default function Segmentado({ opciones, valor, alCambiar }) {
  return (
    <div className="seg">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={o.valor === valor ? 'on' : undefined}
          aria-pressed={o.valor === valor}
          onClick={() => alCambiar(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
