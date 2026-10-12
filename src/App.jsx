import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './componentes/Shell.jsx';
import Empleados from './vistas/Empleados.jsx';
import Exportar from './vistas/Exportar.jsx';
import Registrar from './vistas/Registrar.jsx';
import ReporteEmpleado from './vistas/ReporteEmpleado.jsx';
import ReportePeriodo from './vistas/ReportePeriodo.jsx';
import Semana from './vistas/Semana.jsx';
import Tarifas from './vistas/Tarifas.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/registrar" replace />} />
        <Route path="registrar" element={<Registrar />} />
        <Route path="semana/:anio?/:semana?" element={<Semana />} />
        <Route path="reportes/empleado/:id?" element={<ReporteEmpleado />} />
        <Route path="reportes/periodo" element={<ReportePeriodo />} />
        <Route path="exportar" element={<Exportar />} />
        <Route path="catalogos/empleados" element={<Empleados />} />
        <Route path="catalogos/tarifas" element={<Tarifas />} />
        <Route path="*" element={<Navigate to="/registrar" replace />} />
      </Route>
    </Routes>
  );
}
