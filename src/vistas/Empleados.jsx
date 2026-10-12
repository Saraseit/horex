import { useState } from 'react';
import Alerta from '../componentes/Alerta.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import Insignia from '../componentes/Insignia.jsx';
import Interruptor from '../componentes/Interruptor.jsx';
import Segmentado from '../componentes/Segmentado.jsx';
import Tabla from '../componentes/Tabla.jsx';
import { useToast } from '../componentes/useToast.js';
import { useCambiarActivo, useConteos, useCrearEmpleado, useEmpleados } from '../datos/consultas.js';
import { nombreCorto, normalizar, siNo } from '../logica/formato.js';
import { useSesion } from '../sesion/contexto.js';

const FILTROS = [
  { valor: 'activos', etiqueta: 'Activos' },
  { valor: 'inactivos', etiqueta: 'Inactivos' },
  { valor: 'todos', etiqueta: 'Todos' },
];

export default function Empleados() {
  const toast = useToast();
  const { esSupervisor } = useSesion();
  const empleadosQ = useEmpleados();
  const conteosQ = useConteos();
  const crear = useCrearEmpleado();
  const cambiarActivo = useCambiarActivo();
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState('activos');
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  if ([empleadosQ, conteosQ].some((q) => q.isPending)) return <Cargando error={empleadosQ.error || conteosQ.error} />;

  const empleados = empleadosQ.data;
  const q = normalizar(consulta);
  const lista = empleados
    .filter((e) => (filtro === 'todos' || (filtro === 'activos') === e.activo) && (!q || normalizar(`${e.nombre} ${e.puesto}`).includes(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const activos = empleados.filter((e) => e.activo).length;
  const eventuales = empleados.filter((e) => e.activo && e.grupo === 'Eventual').length;
  const puestos = [...new Set(empleados.map((e) => e.puesto))].sort((a, b) => a.localeCompare(b, 'es'));

  function guardar(ev) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const nombre = String(f.get('nombre')).trim().replace(/\s+/g, ' ');
    if (!nombre) return;
    crear.mutate({
      nombre,
      puesto: f.get('puesto'),
      grupo: f.get('grupo'),
      imss: f.get('imss') === 'SI',
      genera_he: f.get('genera_he') === 'SI',
    }, {
      onSuccess: () => {
        setFormularioAbierto(false);
        setFiltro('activos');
        setConsulta('');
        toast(`Alta: ${nombre}`);
      },
      onError: (e) => toast(e.message),
    });
  }

  function alternar(e) {
    cambiarActivo.mutate({ id: e.id, activo: !e.activo }, {
      onSuccess: () => toast(`${nombreCorto(e.nombre)} ${e.activo ? 'desactivado' : 'reactivado'}`),
      onError: (err) => toast(err.message),
    });
  }

  const columnas = [
    { id: 'nombre', encabezado: 'Nombre', celda: (e) => <b style={{ fontWeight: 500 }}>{e.nombre}</b> },
    { id: 'puesto', encabezado: 'Puesto', celda: (e) => e.puesto },
    { id: 'grupo', encabezado: 'Grupo', celda: (e) => <Insignia variante={e.grupo === 'Eventual' ? 'amber' : undefined}>{e.grupo}</Insignia> },
    { id: 'imss', encabezado: 'IMSS', celda: (e) => siNo(e.imss) },
    { id: 'reclutador', encabezado: 'Reclutador', claseCelda: 'muted', celda: (e) => e.reclutador },
    { id: 'genera', encabezado: 'Genera HE', celda: (e) => (e.genera_he ? 'Sí' : <Insignia variante="ok">Solo alimentos</Insignia>) },
    { id: 'registros', encabezado: 'Registros', tipo: 'num', celda: (e) => conteosQ.data.porEmpleado[e.id] ?? 0 },
    {
      id: 'activo',
      encabezado: 'Activo',
      celda: (e) => (
        <Interruptor
          activo={e.activo} etiqueta="Activo" deshabilitado={!esSupervisor || cambiarActivo.isPending}
          titulo={esSupervisor ? undefined : 'Solo supervisor'} alCambiar={() => alternar(e)}
        />
      ),
    },
  ];

  return (
    <section className="view">
      <EncabezadoVista titulo="Catálogo de empleados" subtitulo={`${activos} activos · ${empleados.length - activos} inactivos · ${eventuales} eventuales`}>
        <input className="input sm" id="emp-q" aria-label="Buscar empleado" placeholder="Buscar nombre o puesto…" value={consulta} onChange={(e) => setConsulta(e.target.value)} style={{ width: 220 }} />
        <Segmentado opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
        <button type="button" className="btn btn-primary" disabled={!esSupervisor} title={esSupervisor ? undefined : 'Solo supervisor'} onClick={() => setFormularioAbierto(true)}>
          + Nuevo empleado
        </button>
      </EncabezadoVista>
      {!esSupervisor && (
        <Alerta tipo="amber" icono="🔒">
          Estás como <strong>Capturista</strong>: puedes consultar el catálogo, pero dar de alta o desactivar empleados es solo del supervisor.
        </Alerta>
      )}
      <div className="card">
        {formularioAbierto && (
          <form className="form-panel" onSubmit={guardar} style={{ borderTop: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label className="label" htmlFor="ne-nombre">Nombre completo <span className="required">*</span></label>
              <input className="input" id="ne-nombre" name="nombre" required placeholder="Nombre(s) y apellidos" autoFocus />
            </div>
            <div className="field">
              <label className="label" htmlFor="ne-puesto">Puesto</label>
              <select className="select" id="ne-puesto" name="puesto" defaultValue="Operador cargador">
                {puestos.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ne-grupo">Grupo</label>
              <select className="select" id="ne-grupo" name="grupo"><option>P. Fijo</option><option>Eventual</option></select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ne-imss">IMSS</label>
              <select className="select" id="ne-imss" name="imss"><option>SI</option><option>NO</option></select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ne-genera">Genera HE</label>
              <select className="select" id="ne-genera" name="genera_he">
                <option value="SI">Sí</option>
                <option value="NO">No (solo alimentos)</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setFormularioAbierto(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={crear.isPending}>Guardar empleado</button>
            </div>
          </form>
        )}
        <Tabla
          columnas={columnas}
          filas={lista}
          clave={(e) => e.id}
          estiloWrap={formularioAbierto ? undefined : { borderTop: 'none' }}
          estiloFila={(e) => (e.activo ? undefined : { opacity: 0.55 })}
          vacio={<tr><td colSpan={8}><div className="empty-state">Sin resultados</div></td></tr>}
        />
      </div>
      <div className="faint" style={{ fontSize: 12 }}>
        Los empleados nunca se borran: al desactivarlos dejan de aparecer en la captura pero conservan su historial.
      </div>
    </section>
  );
}
