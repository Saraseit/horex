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

  it('rutas desconocidas: 404 en JSON', async () => {
    const res = await fetch(`${base}/api/no-existe`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});
