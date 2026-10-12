// Fase 1: sesión de prueba (Mirian Dzul, Supervisor). En la Fase 3 la sesión viene del login real.
// Las pruebas visuales fijan el rol con localStorage['horex:rol-prueba'] = 'CAPTURISTA' | 'SUPERVISOR'.
import { useMemo, useState } from 'react';
import { USUARIO_PRUEBA } from '../datos/datosPrueba.js';
import { ContextoSesion } from './contexto.js';

const CLAVE_ROL_PRUEBA = 'horex:rol-prueba';

function rolDePrueba() {
  try {
    return localStorage.getItem(CLAVE_ROL_PRUEBA) === 'CAPTURISTA' ? 'CAPTURISTA' : 'SUPERVISOR';
  } catch {
    return 'SUPERVISOR';
  }
}

export default function ProveedorSesion({ children }) {
  const [usuario] = useState(() => ({ ...USUARIO_PRUEBA, rol: rolDePrueba() }));
  const valor = useMemo(() => ({
    usuario,
    esSupervisor: usuario.rol === 'SUPERVISOR',
    cerrarSesion: () => {},
  }), [usuario]);
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
