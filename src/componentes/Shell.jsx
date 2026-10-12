import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const TITULOS = [
  ['/registrar', 'Registrar horas extra'],
  ['/semana', 'Semana actual'],
  ['/reportes/empleado', 'Reporte por empleado'],
  ['/reportes/periodo', 'Reporte por período'],
  ['/exportar', 'Exportar para nómina'],
  ['/catalogos/empleados', 'Catálogo de empleados'],
  ['/catalogos/tarifas', 'Tarifas y reglas'],
];

const tituloDe = (pathname) => TITULOS.find(([ruta]) => pathname.startsWith(ruta))?.[1] ?? 'Horex';

/** .app = Sidebar + .main (Topbar + .content con la vista). */
export default function Shell() {
  const { pathname } = useLocation();
  const titulo = tituloDe(pathname);
  const contenido = useRef(null);

  // Como la demo: al cambiar de pestaña el contenido vuelve arriba.
  useEffect(() => {
    if (contenido.current) contenido.current.scrollTop = 0;
    document.title = `${titulo} · Horex`;
  }, [titulo]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar titulo={titulo} />
        <div className="content" id="content" ref={contenido}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
