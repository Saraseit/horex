import { useCallback, useEffect, useRef, useState } from 'react';
import { ContextoToast } from './useToast.js';

const DURACION_MS = 2600;

/** Proveedor global del .toast. */
export default function ProveedorToast({ children }) {
  const [aviso, setAviso] = useState({ mensaje: '', visible: false });
  const temporizador = useRef(null);

  const toast = useCallback((mensaje) => {
    setAviso({ mensaje, visible: true });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso((a) => ({ ...a, visible: false })), DURACION_MS);
  }, []);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return (
    <ContextoToast.Provider value={toast}>
      {children}
      <div className={aviso.visible ? 'toast show' : 'toast'} role="status" aria-live="polite">{aviso.mensaje}</div>
    </ContextoToast.Provider>
  );
}
