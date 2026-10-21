// Filtros de los reportes: nombre (sin acentos ni mayúsculas), grupo y tipo de hora.
import { normalizar } from './formato.js';

export const FILTROS_VACIOS = { buscar: '', grupo: '', tipo: '' };
export const SOLO_ALIMENTOS = 'SOLO_ALIMENTOS';

export const hayFiltros = (f) => !!(f.buscar.trim() || f.grupo || f.tipo);

export function filtrarRegistros(regs, f) {
  const texto = normalizar(f.buscar.trim());
  return regs.filter((r) => (!texto || normalizar(r.nombre).includes(texto))
    && (!f.grupo || r.grupo === f.grupo)
    && (!f.tipo || (f.tipo === SOLO_ALIMENTOS ? !r.tipo_clave : r.tipo_clave === f.tipo)));
}
