import Alerta from './Alerta.jsx';

/** Lugar de la vista mientras llegan los datos (o si fallan). */
export default function Cargando({ error }) {
  return (
    <section className="view" aria-busy={!error}>
      {error
        ? <Alerta tipo="warn">No se pudieron cargar los datos: {error.message}</Alerta>
        : <div className="empty-state">Cargando…</div>}
    </section>
  );
}
