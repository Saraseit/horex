import { claseTipo } from '../logica/reglas.js';

/** .tipo-pill con la variante según el tipo (especial, muerta, sinhe). */
export default function PildoraTipo({ clave, etiqueta }) {
  const variante = claseTipo(clave);
  return <span className={variante ? `tipo-pill ${variante}` : 'tipo-pill'}>{etiqueta}</span>;
}
