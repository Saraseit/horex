// Sesión real: GET /api/sesion dice quién está dentro; el rol viene de la base, no del navegador.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ErrorApi, pedir } from '../datos/api.js';
import { CLAVE_SESION, ContextoSesion } from './contexto.js';

async function leerSesion() {
  try {
    return await pedir('GET', '/sesion');
  } catch (e) {
    // 401 = no hay sesión (o el usuario fue desactivado): no es un error de la app.
    if (e instanceof ErrorApi && e.estado === 401) return { usuario: null, motivo: e.motivo };
    throw e;
  }
}

export default function ProveedorSesion({ children }) {
  const cliente = useQueryClient();
  const consulta = useQuery({ queryKey: CLAVE_SESION, queryFn: leerSesion, staleTime: 5 * 60_000, retry: 1 });
  const [motivoSalida, setMotivoSalida] = useState(null);

  const iniciarSesion = useCallback(async (correo, contrasena) => {
    const { usuario } = await pedir('POST', '/sesion', { correo, contrasena });
    setMotivoSalida(null);
    cliente.setQueryData(CLAVE_SESION, { usuario });
    return usuario;
  }, [cliente]);

  const cerrarSesion = useCallback(async () => {
    await pedir('DELETE', '/sesion').catch(() => {});
    cliente.clear();
    cliente.setQueryData(CLAVE_SESION, { usuario: null });
    setMotivoSalida('cerrada');
  }, [cliente]);

  const usuario = consulta.data?.usuario ?? null;
  const valor = useMemo(() => ({
    usuario,
    esSupervisor: usuario?.rol === 'SUPERVISOR',
    cargando: consulta.isPending,
    error: consulta.error,
    motivo: consulta.data?.motivo ?? motivoSalida,
    iniciarSesion,
    cerrarSesion,
  }), [usuario, consulta.isPending, consulta.error, consulta.data?.motivo, motivoSalida, iniciarSesion, cerrarSesion]);

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
