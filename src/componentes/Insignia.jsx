/** .badge — variante: ok | warn | amber | grey */
export default function Insignia({ variante, children }) {
  return <span className={variante ? `badge ${variante}` : 'badge'}>{children}</span>;
}
