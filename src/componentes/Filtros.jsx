import { FILTROS_VACIOS, SOLO_ALIMENTOS, hayFiltros } from '../logica/filtros.js';

/**
 * Barra de filtros de los reportes. campos: cuáles mostrar ('buscar', 'grupo', 'tipo').
 * total y visibles: cuántos registros hay y cuántos quedan con los filtros.
 */
export default function Filtros({ valor, alCambiar, tipos, campos = ['buscar', 'grupo', 'tipo'], total, visibles }) {
  const cambiar = (k) => (e) => alCambiar({ ...valor, [k]: e.target.value });
  return (
    <div className="filtros" role="search" aria-label="Filtros">
      {campos.includes('buscar') && (
        <input className="input sm" type="search" placeholder="Buscar empleado…" aria-label="Buscar empleado" value={valor.buscar} onChange={cambiar('buscar')} />
      )}
      {campos.includes('grupo') && (
        <select className="select sm" aria-label="Grupo" value={valor.grupo} onChange={cambiar('grupo')}>
          <option value="">Todos los grupos</option>
          <option value="P. Fijo">Personal fijo</option>
          <option value="Eventual">Eventual</option>
        </select>
      )}
      {campos.includes('tipo') && (
        <select className="select sm" aria-label="Tipo de hora" value={valor.tipo} onChange={cambiar('tipo')}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
          <option value={SOLO_ALIMENTOS}>Solo alimentos</option>
        </select>
      )}
      {hayFiltros(valor) && (
        <>
          <span className="faint filtros-cuenta">{visibles} de {total} registros</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => alCambiar(FILTROS_VACIOS)}>Quitar filtros</button>
        </>
      )}
    </div>
  );
}
