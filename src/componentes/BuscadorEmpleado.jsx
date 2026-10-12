import { useEffect, useRef, useState } from 'react';
import { normalizar } from '../logica/formato.js';

const MAXIMO_RESULTADOS = 8;

/**
 * .employee-field + .employee-dropdown: busca desde 2 letras, por varias palabras y sin acentos,
 * sólo entre empleados activos. ↑ ↓ mueven, Enter elige, Esc cierra.
 * Para vaciarlo desde fuera, cambia su `key`.
 */
export default function BuscadorEmpleado({ id, empleados, seleccionado, alSeleccionar, alDeseleccionar, inputRef, placeholder }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const contenedor = useRef(null);

  const consulta = normalizar(texto.trim());
  const terminos = consulta.split(/\s+/);
  const coincidencias = consulta.length < 2 ? [] : empleados
    .filter((e) => e.activo && terminos.every((t) => normalizar(e.nombre).includes(t)))
    .slice(0, MAXIMO_RESULTADOS);

  useEffect(() => {
    const alClicFuera = (ev) => { if (!contenedor.current?.contains(ev.target)) setAbierto(false); };
    document.addEventListener('click', alClicFuera);
    return () => document.removeEventListener('click', alClicFuera);
  }, []);

  function alEscribir(ev) {
    const valor = ev.target.value;
    setTexto(valor);
    if (seleccionado && valor !== seleccionado.nombre) alDeseleccionar();
    setAbierto(normalizar(valor.trim()).length >= 2);
    setResaltado(0);
  }

  function elegir(empleado) {
    setTexto(empleado.nombre);
    setAbierto(false);
    alSeleccionar(empleado);
  }

  function alTeclear(ev) {
    if (!abierto || !coincidencias.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const paso = ev.key === 'ArrowDown' ? 1 : -1;
      setResaltado((i) => (i + paso + coincidencias.length) % coincidencias.length);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      elegir(coincidencias[resaltado]);
    } else if (ev.key === 'Escape') {
      setAbierto(false);
    }
  }

  const idLista = `${id}-lista`;
  return (
    <div className="employee-field" ref={contenedor}>
      <input
        id={id}
        ref={inputRef}
        className="input"
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        value={texto}
        onChange={alEscribir}
        onKeyDown={alTeclear}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
      />
      {abierto && (
        <div className="employee-dropdown" id={idLista} role="listbox">
          {coincidencias.length ? coincidencias.map((e, i) => (
            <div
              key={e.id}
              className={i === resaltado ? 'employee-option hl' : 'employee-option'}
              role="option"
              aria-selected={i === resaltado}
              onClick={() => elegir(e)}
            >
              <span className="emp-name">{e.nombre}</span>
              <span className="emp-meta">{e.puesto} · {e.grupo}</span>
            </div>
          )) : (
            <div className="employee-option"><span className="emp-meta">Sin coincidencias entre empleados activos</span></div>
          )}
        </div>
      )}
    </div>
  );
}
