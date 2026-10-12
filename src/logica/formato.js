import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseD } from './fechas.js';

const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/** "$6,595" */
export const fmtMoneda = (n) => moneda.format(n);
export const redondear1 = (n) => Math.round(n * 10) / 10;
/** "9.5 h" */
export const fmtHoras = (n) => redondear1(n).toLocaleString('es-MX') + ' h';
/** "$60" o "$62.5": tarifa por hora tal como se guardó. */
export const fmtTarifa = (t) => `$${Number(t)}`;

/** "10-oct" */
export const fechaCorta = (fecha) => format(parseD(fecha), 'dd-MMM', { locale: es });
/** "sáb 10 de oct" */
export const fechaLarga = (fecha) => format(parseD(fecha), "EEE dd 'de' MMM", { locale: es });

/** Dos primeras palabras y la tercera: "Yahir Antonio Nah". */
export function nombreCorto(nombre) {
  const p = nombre.split(' ');
  return `${p.slice(0, 2).join(' ')} ${p[2] || ''}`.trimEnd();
}

export function iniciales(nombre) {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}

/** Minúsculas y sin acentos, para buscar y comparar nombres. */
export const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const siNo = (b) => (b ? 'SI' : 'NO');
export const plural = (n, singular, pluralTexto = `${singular}s`) => (n === 1 ? singular : pluralTexto);
