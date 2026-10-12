// Fechas como texto 'yyyy-MM-dd'. Nunca new Date('2026-10-10'): JS lo lee en UTC y en Mérida cae un día antes.
import {
  addDays, addWeeks, endOfMonth, format, getISODay, getISOWeek, getISOWeekYear,
  parseISO, setISOWeek, startOfISOWeek, startOfMonth, subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { HOY_FIJO } from '../configuracion.js';

export const ZONA_HORARIA = 'America/Merida';
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** 'yyyy-MM-dd' → Date a medianoche local. */
export const parseD = (fecha) => parseISO(fecha);
/** Date → 'yyyy-MM-dd' con la fecha local. */
export const aISO = (d) => format(d, 'yyyy-MM-dd');

/** Fecha de hoy en Mérida, sin importar la zona horaria del equipo. */
export function hoyMerida(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

export const hoy = () => HOY_FIJO ?? hoyMerida();

/** Semana ISO (lunes a domingo), igual que ISOWEEKNUM de Excel y extract(week) de Postgres. */
export function semanaISO(fecha) {
  const d = parseD(fecha);
  return { anio: getISOWeekYear(d), semana: getISOWeek(d) };
}

export const claveSemana = ({ anio, semana }) => `${anio}-${String(semana).padStart(2, '0')}`;

export function leerClaveSemana(clave) {
  const [anio, semana] = String(clave).split('-').map(Number);
  return { anio, semana };
}

export const compararSemanas = (a, b) => a.anio - b.anio || a.semana - b.semana;
export const mismaSemana = (a, b) => !!a && !!b && a.anio === b.anio && a.semana === b.semana;

export function lunesDeSemana(anio, semana) {
  // El 4 de enero siempre cae en la semana ISO 1 de su año.
  return aISO(startOfISOWeek(setISOWeek(new Date(anio, 0, 4), semana)));
}

export function diasDeSemana(anio, semana) {
  const lunes = parseD(lunesDeSemana(anio, semana));
  return Array.from({ length: 7 }, (_, i) => aISO(addDays(lunes, i)));
}

export function desplazarSemana({ anio, semana }, n) {
  return semanaISO(aISO(addWeeks(parseD(lunesDeSemana(anio, semana)), n)));
}

/** Semanas de `desde` a `hasta`, ambas incluidas. */
export function semanasEntre(desde, hasta) {
  const lista = [];
  for (let s = desde; compararSemanas(s, hasta) <= 0; s = desplazarSemana(s, 1)) lista.push(s);
  return lista;
}

export const esDomingo = (fecha) => !!fecha && parseD(fecha).getDay() === 0;
/** 0 = lunes … 6 = domingo. */
export const indiceDia = (fecha) => getISODay(parseD(fecha)) - 1;

/** "5 oct – 11 oct 2026" */
export function rangoSemanaTexto(anio, semana) {
  const dias = diasDeSemana(anio, semana);
  const a = parseD(dias[0]);
  const b = parseD(dias[6]);
  return `${format(a, 'd MMM', { locale: es })} – ${format(b, 'd MMM', { locale: es })} ${format(b, 'yyyy')}`;
}

export const inicioDeMes = (fecha) => aISO(startOfMonth(parseD(fecha)));
export const finDeMes = (fecha) => aISO(endOfMonth(parseD(fecha)));
export const mesAnterior = (fecha) => aISO(subMonths(startOfMonth(parseD(fecha)), 1));

/** "Septiembre" */
export function nombreMes(fecha) {
  const m = format(parseD(fecha), 'LLLL', { locale: es });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** "Sep" */
export function mesCorto(fecha) {
  const m = format(parseD(fecha), 'MMM', { locale: es });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export const anioDe = (fecha) => Number(fecha.slice(0, 4));
