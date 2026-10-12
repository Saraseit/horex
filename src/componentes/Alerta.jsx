const ICONOS = { warn: '⚠', ok: '✓', info: 'ℹ', amber: 'ℹ' };

/** .alert — tipo: warn | ok | info | amber */
export default function Alerta({ tipo, icono, estilo, children }) {
  return (
    <div className={`alert ${tipo}`} style={estilo} role={tipo === 'warn' ? 'alert' : undefined}>
      <span className="alert-icon">{icono ?? ICONOS[tipo]}</span>
      <span>{children}</span>
    </div>
  );
}
