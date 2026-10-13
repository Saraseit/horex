import { useNavigate } from 'react-router-dom';
import { semanaCaptura } from '../logica/fechas.js';

export default function Topbar({ titulo }) {
  const navegar = useNavigate();
  // La semana en captura es la pasada: se paga esta semana lo trabajado la anterior.
  const { anio, semana } = semanaCaptura();
  return (
    <header className="topbar">
      <div className="topbar-title">{titulo}</div>
      <div className="topbar-right">
        {/* Un solo nodo de texto: partido en varios, el kerning cambia un píxel respecto a la demo. */}
        <span className="semana-tag" title="Semana en captura: lo trabajado la semana pasada, que se paga esta semana">{`Semana ${semana} · ${anio}`}</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => navegar('/semana')}>Ver semana</button>
      </div>
    </header>
  );
}
