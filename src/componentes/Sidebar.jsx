import { useLocation, useNavigate } from 'react-router-dom';
import { iniciales } from '../logica/formato.js';
import { useSesion } from '../sesion/contexto.js';

const SECCIONES_NAVEGACION = [
  {
    etiqueta: 'Captura',
    items: [
      { ruta: '/registrar', icono: '⏱', texto: 'Registrar HE', captura: true },
      { ruta: '/semana', icono: '▦', texto: 'Semana actual' },
    ],
  },
  {
    etiqueta: 'Reportes',
    items: [
      { ruta: '/reportes/empleado', icono: '◉', texto: 'Por empleado' },
      { ruta: '/reportes/periodo', icono: '▤', texto: 'Por período' },
      { ruta: '/exportar', icono: '⇩', texto: 'Exportar' },
    ],
  },
  {
    etiqueta: 'Catálogos',
    items: [
      { ruta: '/catalogos/empleados', icono: '☰', texto: 'Empleados' },
      { ruta: '/catalogos/tarifas', icono: '$', texto: 'Tarifas y reglas' },
    ],
  },
];

const ROLES = { SUPERVISOR: 'Supervisor', CAPTURISTA: 'Capturista', CONSULTA: 'Consulta' };
const estaEn = (pathname, ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`);

export default function Sidebar() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { usuario, puedeCapturar, cerrarSesion } = useSesion();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark"><span>H</span> ProHorex</div>
        <div className="logo-sub">Control de horas extra</div>
      </div>
      {SECCIONES_NAVEGACION.map((s) => (
        <nav key={s.etiqueta} className="nav-section" aria-label={s.etiqueta}>
          <div className="nav-label">{s.etiqueta}</div>
          {s.items.filter((i) => puedeCapturar || !i.captura).map((i) => {
            const activo = estaEn(pathname, i.ruta);
            return (
              <button
                key={i.ruta}
                type="button"
                className={activo ? 'nav-item active' : 'nav-item'}
                aria-current={activo ? 'page' : undefined}
                onClick={() => navegar(i.ruta)}
              >
                <span className="nav-icon">{i.icono}</span> {i.texto}
              </button>
            );
          })}
        </nav>
      ))}
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">{iniciales(usuario.nombre)}</div>
          <div><div className="user-name">{usuario.nombre}</div><div className="user-role">{ROLES[usuario.rol]}</div></div>
        </div>
        <div className="role-seg uno">
          <button type="button" onClick={async () => { await cerrarSesion(); navegar('/login', { replace: true }); }}>Cerrar sesión</button>
        </div>
      </div>
    </aside>
  );
}
