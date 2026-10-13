// Pruebas de la API (Fase 3: sesión) contra la rama "desarrollo" de Neon con los usuarios de
// scripts/semilla-demo.js. Se saltan si .env no tiene DATABASE_URL_DESARROLLO_API y CONTRASENA_PRUEBA.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from './app.js';
import { crearBd } from './bd.js';
import { validarConfiguracion } from './configuracion.js';
import { contrasenaLegible, hashContrasena, verificarContrasena } from './contrasenas.js';

try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch { /* sin .env */ }
const URL_API = process.env.DATABASE_URL_DESARROLLO_API;
const CONTRASENA = process.env.CONTRASENA_PRUEBA;
const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';

describe('contraseñas', () => {
  it('scrypt: verifica la correcta y rechaza otra', async () => {
    const hash = await hashContrasena('Contraseña segura 2026');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verificarContrasena('Contraseña segura 2026', hash)).toBe(true);
    expect(await verificarContrasena('contraseña segura 2026', hash)).toBe(false);
  });

  it('genera contraseñas legibles', () => {
    expect(contrasenaLegible()).toMatch(/^Horex-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe('configuración', () => {
  const url = (usuario) => `postgresql://${usuario}:x@ep-algo-pooler.neon.tech/neondb`;
  it('exige el rol horex_api y un secreto largo', () => {
    expect(validarConfiguracion({ DATABASE_URL: url('neondb_owner'), JWT_SECRETO: SECRETO })).toMatch(/horex_api/);
    expect(validarConfiguracion({ DATABASE_URL: url('horex_api'), JWT_SECRETO: 'corto' })).toMatch(/32 caracteres/);
    expect(validarConfiguracion({ JWT_SECRETO: SECRETO })).toMatch(/Falta DATABASE_URL/);
    expect(validarConfiguracion({ DATABASE_URL: url('horex_api'), JWT_SECRETO: SECRETO })).toBeNull();
  });
});

describe.skipIf(!URL_API || !CONTRASENA)('API de sesión (rama desarrollo)', () => {
  let servidor;
  let bd;
  let base;

  beforeAll(async () => {
    bd = crearBd(URL_API);
    servidor = crearApp({ bd, secreto: SECRETO, produccion: true }).listen(0);
    await new Promise((ok) => servidor.once('listening', ok));
    base = `http://localhost:${servidor.address().port}`;
  });
  afterAll(async () => {
    servidor?.close();
    await bd?.cerrar();
  });

  const entrar = (correo, contrasena = CONTRASENA) => fetch(`${base}/api/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  const cookieDe = (res) => res.headers.get('set-cookie')?.split(';')[0];

  it('/salud responde sin tocar la base', async () => {
    const res = await fetch(`${base}/salud`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('inicia sesión con cookie httpOnly, SameSite=Strict y Secure', async () => {
    const res = await entrar('SUPERVISOR@prueba.horex ');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ usuario: { id: expect.any(String), nombre: 'Mirian Dzul (prueba)', rol: 'SUPERVISOR' } });
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toMatch(/^horex_sesion=.+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=604800; Secure$/);
  });

  it('con la cookie devuelve el usuario; sin ella o alterada, 401', async () => {
    const cookie = cookieDe(await entrar('capturista@prueba.horex'));
    const conCookie = await fetch(`${base}/api/sesion`, { headers: { cookie } });
    expect(conCookie.status).toBe(200);
    expect((await conCookie.json()).usuario).toMatchObject({ nombre: 'Capturista de prueba', rol: 'CAPTURISTA' });

    expect((await fetch(`${base}/api/sesion`)).status).toBe(401);
    const alterada = `${cookie.slice(0, -3)}abc`;
    expect((await fetch(`${base}/api/sesion`, { headers: { cookie: alterada } })).status).toBe(401);
  });

  it('contraseña o correo equivocados: 401 con el mismo mensaje', async () => {
    const malo = await entrar('supervisor@prueba.horex', 'no-es-la-contraseña');
    const noExiste = await entrar('nadie@prueba.horex', 'no-es-la-contraseña');
    expect(malo.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect((await malo.json()).error).toBe((await noExiste.json()).error);
  });

  it('usuario inactivo: 403 con motivo', async () => {
    const res = await entrar('inactivo@prueba.horex');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ motivo: 'inactivo' });
  });

  it('cerrar sesión borra la cookie', async () => {
    const res = await fetch(`${base}/api/sesion`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/^horex_sesion=; .*Max-Age=0/);
  });

  it('rechaza peticiones que no son JSON (protección contra formularios de otros sitios)', async () => {
    const res = await fetch(`${base}/api/sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'correo=a&contrasena=b',
    });
    expect(res.status).toBe(415);
  });

  it('bloquea tras 10 intentos fallidos con el mismo correo', async () => {
    const correo = `ataque-${Date.now()}@prueba.horex`;
    for (let i = 0; i < 10; i++) expect((await entrar(correo, 'x')).status).toBe(401);
    expect((await entrar(correo, 'x')).status).toBe(429);
  });

  describe('datos', () => {
    let supervisor;
    let capturista;
    const pedir = (cookie, metodo, ruta, cuerpo) => fetch(`${base}/api${ruta}`, {
      method: metodo,
      headers: { cookie, ...(cuerpo && { 'Content-Type': 'application/json' }) },
      body: cuerpo && JSON.stringify(cuerpo),
    });
    const json = async (cookie, metodo, ruta, cuerpo) => {
      const res = await pedir(cookie, metodo, ruta, cuerpo);
      return { estado: res.status, datos: await res.json().catch(() => null) };
    };

    beforeAll(async () => {
      supervisor = cookieDe(await entrar('supervisor@prueba.horex'));
      capturista = cookieDe(await entrar('capturista@prueba.horex'));
    });

    it('sin sesión no se ve nada', async () => {
      expect((await fetch(`${base}/api/empleados`)).status).toBe(401);
      expect((await fetch(`${base}/api/registros`)).status).toBe(401);
    });

    it('catálogos, parámetros y semanas', async () => {
      const { datos: empleados } = await json(capturista, 'GET', '/empleados');
      expect(empleados.length).toBeGreaterThanOrEqual(25);
      expect(empleados[0]).toHaveProperty('genera_he');
      const { datos: parametros } = await json(capturista, 'GET', '/parametros');
      expect(Object.keys(parametros).sort()).toEqual(['monto_almuerzo', 'monto_cena', 'monto_desayuno', 'tarifa_domingo_eventual']);
      const { datos: semanas } = await json(capturista, 'GET', '/registros/semanas');
      expect(semanas).toContainEqual({ anio: 2026, semana: 41 });
    });

    it('registros de una semana con importes por comida y números (no texto)', async () => {
      const { datos } = await json(capturista, 'GET', '/registros?anio=2026&semana=41');
      expect(datos.length).toBeGreaterThan(0);
      const r = datos[0];
      expect(typeof r.total).toBe('number');
      expect(r.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r).toHaveProperty('importe_desayuno');
      expect(r).toHaveProperty('nombre');
    });

    it('captura: la base calcula la tarifa; el supervisor elimina; todo o nada', async () => {
      const { datos: empleados } = await json(supervisor, 'GET', '/empleados');
      const fijo = empleados.find((e) => e.activo && e.genera_he && e.grupo === 'P. Fijo');
      const nuevo = await json(capturista, 'POST', '/registros', {
        empleado_id: fijo.id, fecha: '2026-10-05', tipo_clave: 'NORMAL_LOCAL', horas: 1.5, tarifa_aplicada: 999, desayuno: true,
      });
      expect(nuevo.estado).toBe(201);
      expect(nuevo.datos).toMatchObject({ tarifa_aplicada: 60, importe_he: 90, desayuno: true, capturado_por_nombre: 'Capturista de prueba' });

      expect((await json(capturista, 'POST', '/registros/eliminar', { ids: [nuevo.datos.id] })).estado).toBe(403);
      expect(await json(supervisor, 'POST', '/registros/eliminar', { ids: [nuevo.datos.id] })).toEqual({ estado: 200, datos: { eliminados: 1 } });
      const otraVez = await json(supervisor, 'POST', '/registros/eliminar', { ids: [nuevo.datos.id] });
      expect(otraVez.estado).toBe(409);
    });

    it('edición: sólo el supervisor; corrige horas y agrega una comida', async () => {
      const { datos: empleados } = await json(supervisor, 'GET', '/empleados');
      const fijo = empleados.find((e) => e.activo && e.genera_he && e.grupo === 'P. Fijo');
      const { datos: r } = await json(supervisor, 'POST', '/registros', { empleado_id: fijo.id, fecha: '2026-10-06', tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      const cambios = { fecha: '2026-10-06', tipo_clave: 'NORMAL_LOCAL', horas: 2.5, desayuno: false, almuerzo: false, cena: true };
      expect((await json(capturista, 'PATCH', `/registros/${r.id}`, cambios)).estado).toBe(403);
      const editado = await json(supervisor, 'PATCH', `/registros/${r.id}`, cambios);
      expect(editado.estado).toBe(200);
      expect(editado.datos).toMatchObject({ id: r.id, horas: 2.5, tarifa_aplicada: 60, importe_he: 150, cena: true });
      expect(editado.datos.editado_at).toBeTruthy();
      expect((await json(capturista, 'GET', `/registros/${r.id}`)).datos.horas).toBe(2.5);
      await json(supervisor, 'POST', '/registros/eliminar', { ids: [r.id] });
      expect((await json(supervisor, 'GET', `/registros/${r.id}`)).estado).toBe(404);
    });

    it('registro de sólo comida para quien sí genera horas extra', async () => {
      const { datos: empleados } = await json(supervisor, 'GET', '/empleados');
      const fijo = empleados.find((e) => e.activo && e.genera_he);
      const { estado, datos } = await json(capturista, 'POST', '/registros', { empleado_id: fijo.id, fecha: '2026-10-06', tipo_clave: null, horas: 0, almuerzo: true });
      expect(estado).toBe(201);
      expect(datos).toMatchObject({ tipo_clave: null, horas: 0, tipo_etiqueta: 'Solo alimentos', almuerzo: true });
      await json(supervisor, 'POST', '/registros/eliminar', { ids: [datos.id] });
    });

    it('rechazos de la base llegan con su mensaje', async () => {
      const { datos: empleados } = await json(supervisor, 'GET', '/empleados');
      const fijo = empleados.find((e) => e.activo && e.genera_he);
      const futura = await json(capturista, 'POST', '/registros', { empleado_id: fijo.id, fecha: '2099-01-05', tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(futura).toMatchObject({ estado: 400, datos: { error: 'No se pueden capturar fechas futuras.' } });
      const cerrada = await json(capturista, 'POST', '/registros', { empleado_id: fijo.id, fecha: '2026-09-30', tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(cerrada.datos.error).toMatch(/semana 40 está cerrada/);
    });

    it('sólo el supervisor cambia tarifas y montos de comidas', async () => {
      expect((await json(capturista, 'PATCH', '/tipos', { cambios: { MUERTA: 31 } })).estado).toBe(403);
      expect((await json(capturista, 'PATCH', '/parametros', { cambios: { monto_cena: 1 } })).estado).toBe(403);
      const { datos: p } = await json(supervisor, 'GET', '/parametros');
      expect(await json(supervisor, 'PATCH', '/parametros', { cambios: { monto_almuerzo: p.monto_almuerzo + 1 } }))
        .toEqual({ estado: 200, datos: { cambiados: 1 } });
      await json(supervisor, 'PATCH', '/parametros', { cambios: { monto_almuerzo: p.monto_almuerzo } });
      expect((await json(supervisor, 'PATCH', '/parametros', { cambios: { inventado: 1 } })).estado).toBe(400);
    });
  });

  it('rutas desconocidas: 404 en JSON', async () => {
    const res = await fetch(`${base}/api/no-existe`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});
