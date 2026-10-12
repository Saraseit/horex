// Fase 3: inicio y cierre de sesión, rutas protegidas y usuario desactivado (API simulada).
import { expect, test } from '@playwright/test';
import { conSesion, simularApiSesion } from './ayudas.js';

test('sin sesión manda al login y, al entrar, regresa a donde iba', async ({ page }) => {
  await simularApiSesion(page);
  await page.goto('/semana/2026/40');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo').fill('mirian@ejemplo.mx');
  await page.getByLabel('Contraseña').fill('correcta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/semana\/2026\/40$/);
  await expect(page.locator('.view-head h2')).toHaveText('Semana 40');
  await expect(page.locator('.user-name')).toHaveText('Mirian Dzul');
  await expect(page.locator('.user-role')).toHaveText('Supervisor');
});

test('credenciales incorrectas: aviso y sigue en el login', async ({ page }) => {
  await simularApiSesion(page);
  await page.goto('/login');
  await page.getByLabel('Correo').fill('mirian@ejemplo.mx');
  await page.getByLabel('Contraseña').fill('otra');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('.alert.warn')).toHaveText(/Correo o contraseña incorrectos/);
  await expect(page).toHaveURL(/\/login$/);
});

test('usuario desactivado: el login lo explica', async ({ page }) => {
  await simularApiSesion(page, { inactivo: true });
  await page.goto('/registrar');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.alert.warn')).toHaveText(/desactivado/);
});

test('cerrar sesión borra la sesión y vuelve al login', async ({ page }) => {
  const vistas = await simularApiSesion(page);
  await page.goto('/login');
  await page.getByLabel('Correo').fill('mirian@ejemplo.mx');
  await page.getByLabel('Contraseña').fill('correcta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/registrar$/);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(vistas).toContain('DELETE');
  await page.goto('/registrar');
  await expect(page).toHaveURL(/\/login$/);
});

test('con sesión, /login lleva directo a la app', async ({ page }) => {
  await conSesion(page, 'CAPTURISTA');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/registrar$/);
  await expect(page.locator('.user-role')).toHaveText('Capturista');
});

test('el rol viene de la sesión: la capturista ve los permisos de supervisor deshabilitados', async ({ page }) => {
  await conSesion(page, 'CAPTURISTA');
  await page.goto('/catalogos/empleados');
  await expect(page.getByRole('button', { name: '+ Nuevo empleado' })).toBeDisabled();
  await expect(page.locator('.alert.amber')).toContainText('Capturista');
});
