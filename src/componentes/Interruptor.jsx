/** .switch */
export default function Interruptor({ activo, alCambiar, deshabilitado, etiqueta, titulo }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={titulo}
      className={activo ? 'switch on' : 'switch'}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
    />
  );
}
