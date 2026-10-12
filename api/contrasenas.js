// Hash de contraseñas con scrypt (módulo crypto de Node, sin dependencias).
// Formato guardado: scrypt$N$r$p$sal$hash (sal y hash en base64url).
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 16384;
const R = 8;
const P = 1;
const LARGO = 64;

export async function hashContrasena(contrasena) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(contrasena.normalize('NFC'), sal, LARGO, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verificarContrasena(contrasena, guardado) {
  const [algoritmo, n, r, p, sal, hash] = String(guardado).split('$');
  if (algoritmo !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = await scryptAsync(contrasena.normalize('NFC'), Buffer.from(sal, 'base64url'), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(esperado, calculado);
}

/** Contraseña legible para entregar a una persona: Horex-XXXX-XXXX (sin 0/O, 1/I/L). */
export function contrasenaLegible() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bloque = () => Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join('');
  return `Horex-${bloque()}-${bloque()}-${bloque()}`;
}
