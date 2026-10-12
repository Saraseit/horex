// Ayudas de Playwright. La prueba corre contra `vite preview` (sin API): la sesión se simula.

export const USUARIO_SIMULADO = { id: 'usuario-simulado', nombre: 'Mirian Dzul' };

/** Simula GET /api/sesion con un usuario de ese rol (null = sin sesión). Reemplaza la simulación anterior. */
export async function conSesion(page, rol = 'SUPERVISOR') {
  await page.unroute('**/api/sesion');
  await page.route('**/api/sesion', (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204 });
    return rol
      ? route.fulfill({ json: { usuario: { ...USUARIO_SIMULADO, rol } } })
      : route.fulfill({ status: 401, json: { error: 'Inicia sesión para continuar.' } });
  });
}

/**
 * Simula el ciclo completo: login (contraseña "correcta"), sesión y cierre. Devuelve las peticiones vistas.
 * Con `inactivo`, GET responde 401 con motivo 'inactivo'.
 */
export async function simularApiSesion(page, { inactivo = false } = {}) {
  let usuario = null;
  const vistas = [];
  await page.route('**/api/sesion', (route) => {
    const metodo = route.request().method();
    vistas.push(metodo);
    if (metodo === 'GET') {
      if (inactivo) return route.fulfill({ status: 401, json: { error: 'Tu usuario está desactivado.', motivo: 'inactivo' } });
      return usuario ? route.fulfill({ json: { usuario } }) : route.fulfill({ status: 401, json: { error: 'Inicia sesión para continuar.' } });
    }
    if (metodo === 'POST') {
      const { contrasena } = route.request().postDataJSON();
      if (contrasena !== 'correcta') return route.fulfill({ status: 401, json: { error: 'Correo o contraseña incorrectos.' } });
      usuario = { ...USUARIO_SIMULADO, rol: 'SUPERVISOR' };
      return route.fulfill({ json: { usuario } });
    }
    usuario = null;
    return route.fulfill({ status: 204 });
  });
  return vistas;
}
