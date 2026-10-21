import { createContext, useContext } from 'react';

export const ContextoSesion = createContext(null);
export const CLAVE_SESION = ['sesion'];

/**
 * { usuario: { id, nombre, rol } | null, esSupervisor, puedeCapturar, cargando, motivo, iniciarSesion, cerrarSesion }
 * motivo: 'inactivo' si la API cerró la sesión porque el usuario fue desactivado.
 */
export function useSesion() {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error('useSesion necesita <ProveedorSesion>');
  return sesion;
}
