import { useState } from 'react';
import ConfirmacionEnLinea from './ConfirmacionEnLinea.jsx';
import { plural } from '../logica/formato.js';

/** Acción de encabezado de tarjeta: "Eliminar seleccionados (n)" con confirmación en línea. */
export default function BorradoMasivo({ cantidad, alConfirmar, ocupado }) {
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando && cantidad > 0) {
    return (
      <ConfirmacionEnLinea
        pregunta={`¿Eliminar ${cantidad} ${plural(cantidad, 'registro')}?`}
        ocupado={ocupado}
        alConfirmar={() => { alConfirmar(); setConfirmando(false); }}
        alCancelar={() => setConfirmando(false)}
      />
    );
  }
  return (
    <button
      type="button"
      className={cantidad ? 'btn btn-danger btn-xs' : 'btn btn-ghost btn-xs'}
      disabled={!cantidad || ocupado}
      title={cantidad ? undefined : 'Marca las casillas de los registros que quieres eliminar'}
      onClick={() => setConfirmando(true)}
    >
      Eliminar seleccionados{cantidad ? ` (${cantidad})` : ''}
    </button>
  );
}
