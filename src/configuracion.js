// Modo de prueba (npm run build:prueba, que usan las pruebas de Playwright): datos de la demo en memoria
// y "hoy" fijo en el sábado 10 oct 2026, para que las pantallas se comparen contra la demo.
// En producción no hay nada fijo: los datos vienen de la API y "hoy" es la fecha de Mérida.
const entorno = import.meta.env ?? {};
export const DATOS_PRUEBA = entorno.VITE_DATOS_PRUEBA === '1';
export const HOY_FIJO = entorno.VITE_HOY_FIJO || null;
