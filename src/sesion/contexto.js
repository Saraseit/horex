import { createContext, useContext } from 'react';

export const ContextoSesion = createContext(null);

/** { usuario: { id, nombre, rol }, esSupervisor, cerrarSesion } */
export function useSesion() {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error('useSesion necesita <ProveedorSesion>');
  return sesion;
}
