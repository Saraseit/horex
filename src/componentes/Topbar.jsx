import { useNavigate } from 'react-router-dom';
import { hoy, semanaISO } from '../logica/fechas.js';

export default function Topbar({ titulo }) {
  const navegar = useNavigate();
  const { anio, semana } = semanaISO(hoy());
  return (
    <header className="topbar">
      <div className="topbar-title">{titulo}</div>
      <div className="topbar-right">
        {/* Un solo nodo de texto: partido en varios, el kerning cambia un píxel respecto a la demo. */}
        <span className="semana-tag">{`Semana ${semana} · ${anio}`}</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => navegar('/semana')}>Ver semana</button>
      </div>
    </header>
  );
}
