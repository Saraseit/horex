import { fmtMoneda } from '../logica/formato.js';

/** Monto de una comida con su cantidad: "$120 (2)". Sin comidas: "—". */
export default function MontoComida({ monto, cantidad }) {
  if (!cantidad) return <span className="faint">—</span>;
  return <>{fmtMoneda(monto)} <small className="faint">({cantidad})</small></>;
}
