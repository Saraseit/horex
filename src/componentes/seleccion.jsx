// Selección de filas por casilla para el borrado masivo (agregado en Horex; la demo no lo tiene).
import { useState } from 'react';

/** Conjunto de ids seleccionados. */
export function useSeleccion() {
  const [ids, setIds] = useState(() => new Set());
  return {
    tiene: (id) => ids.has(id),
    alternar: (id) => setIds((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    }),
    fijar: (lista, marcar) => setIds((actual) => {
      const nuevo = new Set(actual);
      lista.forEach((id) => (marcar ? nuevo.add(id) : nuevo.delete(id)));
      return nuevo;
    }),
    limpiar: () => setIds(new Set()),
  };
}

/**
 * Primera columna de Tabla con casillas. `elegibles`: ids que se pueden seleccionar;
 * `motivoBloqueo(fila)`: texto de ayuda en las que no (p. ej. "Semana cerrada").
 */
export function columnaSeleccion({ seleccion, elegibles, motivoBloqueo }) {
  const marcados = elegibles.filter((id) => seleccion.tiene(id)).length;
  const todos = elegibles.length > 0 && marcados === elegibles.length;
  return {
    id: 'seleccion',
    claseEncabezado: 'col-casilla',
    claseCelda: 'col-casilla',
    encabezado: (
      <input
        type="checkbox"
        className="casilla"
        aria-label="Seleccionar todos"
        checked={todos}
        disabled={!elegibles.length}
        ref={(el) => { if (el) el.indeterminate = marcados > 0 && !todos; }}
        onChange={() => seleccion.fijar(elegibles, !todos)}
      />
    ),
    celda: (r) => {
      const elegible = elegibles.includes(r.id);
      return (
        <input
          type="checkbox"
          className="casilla"
          aria-label={`Seleccionar registro del ${r.fecha} de ${r.nombre}`}
          checked={elegible && seleccion.tiene(r.id)}
          disabled={!elegible}
          title={elegible ? undefined : motivoBloqueo?.(r)}
          onChange={() => seleccion.alternar(r.id)}
        />
      );
    },
  };
}
