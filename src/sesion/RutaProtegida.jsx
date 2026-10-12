import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Alerta from '../componentes/Alerta.jsx';
import { useSesion } from './contexto.js';

/** Sólo deja pasar con sesión y usuario activo; si no, manda a /login y recuerda a dónde iba. */
export default function RutaProtegida() {
  const { usuario, cargando, error } = useSesion();
  const ubicacion = useLocation();

  if (cargando) {
    return <div className="login-pagina"><div className="empty-state" aria-busy="true">Cargando…</div></div>;
  }
  if (error) {
    return (
      <div className="login-pagina">
        <div className="login-tarjeta"><Alerta tipo="warn">{error.message}</Alerta></div>
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return <Outlet />;
}
