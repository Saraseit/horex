import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alerta from '../componentes/Alerta.jsx';
import { useSesion } from '../sesion/contexto.js';

const AVISOS = {
  inactivo: 'Tu usuario está desactivado. Habla con el supervisor para que lo reactive.',
  cerrada: null,
};

/** Inicio de sesión: tarjeta centrada, sin registro público (los usuarios los da de alta el supervisor). */
export default function Login() {
  const { usuario, iniciarSesion, motivo } = useSesion();
  const navegar = useNavigate();
  const desde = useLocation().state?.desde ?? '/registrar';
  const [error, setError] = useState(AVISOS[motivo] ?? '');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={desde} replace />;

  async function entrar(ev) {
    ev.preventDefault();
    const datos = new FormData(ev.currentTarget);
    setEnviando(true);
    setError('');
    try {
      await iniciarSesion(String(datos.get('correo')), String(datos.get('contrasena')));
      navegar(desde, { replace: true });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login-pagina">
      <form className="card login-tarjeta" onSubmit={entrar}>
        <div className="card-body stack" style={{ gap: 16, paddingTop: 24 }}>
          <div className="login-logo"><span>H</span> ProHorex</div>
          <div>
            <h2 className="login-titulo">Iniciar sesión</h2>
            <p className="muted" style={{ fontSize: 13 }}>Control de horas extra</p>
          </div>
          {error && <Alerta tipo="warn">{error}</Alerta>}
          <div className="field">
            <label className="label" htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" className="input" autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="contrasena">Contraseña</label>
            <input id="contrasena" name="contrasena" type="password" className="input" autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="faint" style={{ fontSize: 12, textAlign: 'center' }}>¿Sin acceso? Pídeselo al supervisor de nómina.</p>
        </div>
      </form>
    </div>
  );
}
