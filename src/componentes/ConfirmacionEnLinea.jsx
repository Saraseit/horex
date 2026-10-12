/** Patrón "¿Eliminar? Sí / No" de la demo, en lugar de window.confirm. */
export default function ConfirmacionEnLinea({ pregunta = '¿Eliminar?', alConfirmar, alCancelar, ocupado }) {
  return (
    <span className="toolbar" style={{ justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 12 }} className="muted">{pregunta}</span>
      <button type="button" className="btn btn-danger btn-xs" onClick={alConfirmar} disabled={ocupado}>Sí</button>
      <button type="button" className="btn btn-ghost btn-xs" onClick={alCancelar} disabled={ocupado}>No</button>
    </span>
  );
}
