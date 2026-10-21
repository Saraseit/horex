import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './componentes/Shell.jsx';
import RutaProtegida from './sesion/RutaProtegida.jsx';
import { useSesion } from './sesion/contexto.js';
import Empleados from './vistas/Empleados.jsx';
import Exportar from './vistas/Exportar.jsx';
import Login from './vistas/Login.jsx';
import Registrar from './vistas/Registrar.jsx';
import ReporteEmpleado from './vistas/ReporteEmpleado.jsx';
import ReportePeriodo from './vistas/ReportePeriodo.jsx';
import Semana from './vistas/Semana.jsx';
import Tarifas from './vistas/Tarifas.jsx';

/** Inicio según el rol: quien captura entra a Registrar HE; el usuario de consulta, a Semana actual. */
function Inicio() {
  const { puedeCapturar } = useSesion();
  return <Navigate to={puedeCapturar ? '/registrar' : '/semana'} replace />;
}

function SoloCaptura({ children }) {
  const { puedeCapturar } = useSesion();
  return puedeCapturar ? children : <Navigate to="/semana" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      {/* Todo lo demás exige sesión y usuario activo. */}
      <Route element={<RutaProtegida />}>
        <Route element={<Shell />}>
          <Route index element={<Inicio />} />
          <Route path="registrar" element={<SoloCaptura><Registrar /></SoloCaptura>} />
          <Route path="semana/:anio?/:semana?" element={<Semana />} />
          <Route path="reportes/empleado/:id?" element={<ReporteEmpleado />} />
          <Route path="reportes/periodo" element={<ReportePeriodo />} />
          <Route path="exportar" element={<Exportar />} />
          <Route path="catalogos/empleados" element={<Empleados />} />
          <Route path="catalogos/tarifas" element={<Tarifas />} />
          <Route path="*" element={<Inicio />} />
        </Route>
      </Route>
    </Routes>
  );
}
