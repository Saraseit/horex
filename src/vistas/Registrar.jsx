import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Alerta from '../componentes/Alerta.jsx';
import BuscadorEmpleado from '../componentes/BuscadorEmpleado.jsx';
import Cargando from '../componentes/Cargando.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { useToast } from '../componentes/useToast.js';
import {
  useCrearRegistro, useEditarRegistro, useEmpleados, useParametros, useRegistro, useRegistrosDia, useRegistrosRecientes, useTipos,
} from '../datos/consultas.js';
import { diasDeSemana, esDomingo, hoy, rangoSemanaTexto, semanaCaptura } from '../logica/fechas.js';
import { fechaCorta, fechaLarga, fmtHoras, fmtMoneda, nombreCorto, siNo } from '../logica/formato.js';
import { calcularTarifa, claseTipo, esEspecial, montoComida, notaRegla } from '../logica/reglas.js';
import { useSesion } from '../sesion/contexto.js';

const ALIMENTOS = [
  { clave: 'desayuno', icono: '☕', texto: 'Desayuno' },
  { clave: 'almuerzo', icono: '🥗', texto: 'Almuerzo' },
  { clave: 'cena', icono: '🌙', texto: 'Cena' },
];
const SIN_ALIMENTOS = { desayuno: false, almuerzo: false, cena: false };
const SIN_MANUAL = { activa: false, tarifa: '', nota: '' };

/** Captura nueva, o edición de un registro con /registrar?editar=ID (sólo supervisor). */
export default function Registrar() {
  const [busqueda] = useSearchParams();
  const editarId = Number(busqueda.get('editar')) || null;
  const registroQ = useRegistro(editarId);
  if (editarId && (registroQ.isPending || registroQ.error)) return <Cargando error={registroQ.error} />;
  return <FormularioRegistro key={editarId ?? 'nuevo'} edicion={editarId ? registroQ.data : null} />;
}

function FormularioRegistro({ edicion }) {
  const toast = useToast();
  const navegar = useNavigate();
  const empleadosQ = useEmpleados();
  const tiposQ = useTipos();
  const parametrosQ = useParametros();
  const recientesQ = useRegistrosRecientes(7);
  const crear = useCrearRegistro();
  const editar = useEditarRegistro();
  const { esSupervisor } = useSesion();
  const hoyF = hoy();
  // Se captura la semana pasada (en la 42 se paga lo trabajado en la 41).
  const captura = semanaCaptura();
  const diasCaptura = diasDeSemana(captura.anio, captura.semana);
  const fechaMaxima = edicion ? hoyF : diasCaptura[6];

  const [empleadoId, setEmpleadoId] = useState(edicion?.empleado_id ?? null);
  const [horasTexto, setHorasTexto] = useState(edicion?.horas ? String(edicion.horas) : '');
  const [tipo, setTipo] = useState(edicion?.tipo_clave ?? null);
  const [fecha, setFecha] = useState(edicion?.fecha ?? diasCaptura[0]);
  const [alimentos, setAlimentos] = useState(edicion
    ? { desayuno: edicion.desayuno, almuerzo: edicion.almuerzo, cena: edicion.cena }
    : SIN_ALIMENTOS);
  // Tarifa manual (sólo supervisor): excepción con nota obligatoria; la base la valida otra vez.
  const [manual, setManual] = useState(edicion?.tarifa_manual
    ? { activa: true, tarifa: String(edicion.tarifa_aplicada), nota: edicion.nota ?? '' }
    : SIN_MANUAL);
  const [error, setError] = useState('');
  const [ultimoId, setUltimoId] = useState(null);
  const [vueltaBuscador, setVueltaBuscador] = useState(0);
  const buscadorRef = useRef(null);
  const horasRef = useRef(null);
  const delDiaQ = useRegistrosDia(empleadoId, fecha);
  const empleado = empleadosQ.data?.find((e) => e.id === empleadoId) ?? null;

  // Al elegir empleado el foco pasa a Horas; después de guardar, de vuelta al buscador.
  useEffect(() => { if (!edicion && empleadoId) horasRef.current?.focus(); }, [edicion, empleadoId]);
  useEffect(() => { if (vueltaBuscador) buscadorRef.current?.focus(); }, [vueltaBuscador]);

  const consultas = [empleadosQ, tiposQ, parametrosQ, recientesQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;
  const tipos = tiposQ.data;
  const parametros = parametrosQ.data;

  const sinHE = !!empleado && !empleado.genera_he;
  const usaManual = manual.activa && !sinHE;
  const tarifaManual = parseFloat(manual.tarifa);
  // En una edición, si no cambian tipo ni fecha, se conserva la tarifa con que se capturó (igual que la base).
  const conservaTarifa = !!edicion && !edicion.tarifa_manual && !!edicion.tipo_clave && tipo === edicion.tipo_clave && fecha === edicion.fecha;
  // Sin empleado (o si no genera HE) los botones muestran la tarifa base del tipo, como la demo.
  const tarifaDe = (clave) => {
    if (conservaTarifa && clave === edicion.tipo_clave) return { tarifa: Number(edicion.tarifa_aplicada), regla: null };
    if (!empleado || sinHE) return { tarifa: Number(tipos.find((t) => t.clave === clave).tarifa), regla: null };
    return calcularTarifa({ empleado, fecha, tipoClave: clave, tipos, parametros });
  };
  const { tarifa, regla } = tipo && !sinHE
    ? (usaManual ? { tarifa: Number.isFinite(tarifaManual) ? tarifaManual : 0, regla: null } : tarifaDe(tipo))
    : { tarifa: 0, regla: null };
  const horas = sinHE ? 0 : parseFloat(horasTexto) || 0;
  // Una edición conserva los montos de comida guardados; una captura usa los vigentes (cena del eventual aparte).
  const montoDe = (clave) => (edicion ? Number(edicion[`monto_${clave}`] ?? 0) : montoComida(clave, parametros, empleado));
  const elegidos = ALIMENTOS.filter((a) => alimentos[a.clave]);
  const importeAlimentos = elegidos.reduce((t, a) => t + montoDe(a.clave), 0);
  const manualValida = !usaManual || (Number.isFinite(tarifaManual) && tarifaManual >= 0 && manual.nota.trim() !== '');
  const conHoras = !sinHE && !!tipo && horas > 0 && horas <= 24 && manualValida;
  // Registro de sólo comida: sin horas ni tipo, con al menos una comida (también para quien sí genera HE).
  const soloComida = (sinHE || (!tipo && horas === 0)) && importeAlimentos > 0;
  const importe = conHoras ? horas * tarifa : 0;
  const domingo = esDomingo(fecha);
  const tarifaEspecial = Number(tipos.find((t) => t.clave === 'ESPECIAL_LOCAL')?.tarifa ?? 0);
  // Un empleado puede tener varios registros el mismo día (uno por tipo de hora): se listan, no se bloquean.
  const delDia = empleado ? (delDiaQ.data ?? []).filter((r) => r.id !== edicion?.id) : [];
  // Una comida que ya está en otro registro de ese día se pagaría dos veces.
  const comidasRepetidas = elegidos.filter((a) => delDia.some((r) => r[a.clave]));
  const ocupado = crear.isPending || editar.isPending;
  const valido = !!empleado && !!fecha && fecha <= fechaMaxima && !ocupado && (conHoras || soloComida);

  const cambio = (fn) => (...args) => { setError(''); fn(...args); };

  function seleccionar(e) {
    setError('');
    setEmpleadoId(e.id);
    if (!e.genera_he) { setTipo(null); setHorasTexto(''); }
  }

  const datos = () => ({
    fecha,
    tipo_clave: conHoras ? tipo : null,
    horas: conHoras ? horas : 0,
    ...alimentos,
    ...(conHoras && usaManual && { tarifa_manual: true, tarifa_aplicada: tarifaManual, nota: manual.nota.trim() }),
  });

  // otroTipo: guarda y deja empleado y fecha para capturar otro tipo de hora del mismo día.
  function guardar(otroTipo = false) {
    if (edicion) {
      editar.mutate({ id: edicion.id, ...datos() }, {
        onSuccess: (r) => {
          toast(`Registro actualizado: ${nombreCorto(r.nombre)} · ${fmtMoneda(r.total)}`);
          navegar(`/semana/${r.anio_iso}/${r.semana}`);
        },
        onError: (e) => setError(e.message),
      });
      return;
    }
    crear.mutate({ empleado_id: empleado.id, ...datos() }, {
      onSuccess: (r) => {
        setUltimoId(r.id);
        toast(`Guardado: ${nombreCorto(empleado.nombre)} · ${fmtMoneda(r.total)}`);
        setHorasTexto('');
        setTipo(null);
        setAlimentos(SIN_ALIMENTOS);
        setManual(SIN_MANUAL);
        if (otroTipo) {
          horasRef.current?.focus();
        } else {
          setEmpleadoId(null);
          setVueltaBuscador((v) => v + 1);
        }
      },
      onError: (e) => setError(e.message),
    });
  }

  const alternarAlimento = (clave) => { setError(''); setAlimentos((a) => ({ ...a, [clave]: !a[clave] })); };

  let nota = notaRegla({ tarifa, regla, tipoClave: tipo, fecha });
  if (usaManual) nota = 'Tarifa manual (queda marcada en los reportes con su nota)';
  if (soloComida && !sinHE) nota = 'Registro de sólo comida (sin horas extra)';

  return (
    <section className="view">
      {edicion && (
        <Alerta tipo="info" icono="✎">
          Editando el registro del <strong>{fechaLarga(edicion.fecha)}</strong> de <strong>{edicion.nombre}</strong>.
          {' '}Las comidas conservan el monto con que se capturaron; la tarifa se recalcula sólo si cambias el tipo o la fecha.
        </Alerta>
      )}
      <div className="capture-grid">
        <div className="stack">
          <Tarjeta titulo="Empleado" subtitulo={edicion ? 'Para cambiar de empleado, elimina el registro y captúralo de nuevo' : 'Escribe al menos 2 letras del nombre o apellido'} claseCuerpo="stack" estiloCuerpo={{ gap: 14 }}>
            <div className="field">
              <label className="label" htmlFor="emp-search">Empleado <span className="required">*</span></label>
              {edicion ? (
                <input id="emp-search" className="input" value={edicion.nombre} disabled />
              ) : (
                <BuscadorEmpleado
                  key={vueltaBuscador}
                  id="emp-search"
                  inputRef={buscadorRef}
                  empleados={empleadosQ.data}
                  seleccionado={empleado}
                  alSeleccionar={seleccionar}
                  alDeseleccionar={cambio(() => setEmpleadoId(null))}
                  placeholder="Ej. Nah, Cortes, Gamboa…"
                />
              )}
            </div>
            {empleado && (
              <div className="info-strip">
                <div className="info-item"><span className="info-lbl">Puesto</span><span className="info-val">{empleado.puesto}</span></div>
                <div className="info-item"><span className="info-lbl">Grupo</span><span className="info-val">{empleado.grupo}</span></div>
                <div className="info-item"><span className="info-lbl">IMSS</span><span className="info-val">{siNo(empleado.imss)}</span></div>
                <div className="info-item"><span className="info-lbl">Reclutador</span><span className="info-val">{empleado.reclutador}</span></div>
              </div>
            )}
            {sinHE && (
              <Alerta tipo="amber"><strong>{empleado.puesto}</strong> no genera horas extra. Solo registra desayuno o cena si aplica.</Alerta>
            )}
            {delDia.length > 0 && (
              <Alerta tipo="info" icono="◆">
                <strong>{nombreCorto(empleado.nombre)}</strong> ya tiene {delDia.length === 1 ? 'un registro' : `${delDia.length} registros`} el {fechaLarga(fecha)}:
                {' '}{delDia.map((r) => (r.horas ? `${r.tipo_etiqueta} ${fmtHoras(r.horas)}` : r.tipo_etiqueta)).join(' · ')}.
                {' '}Puedes agregar otro tipo de hora; cada uno se guarda como registro aparte.
              </Alerta>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Horas extra"
            subtitulo={`Semana en captura: ${captura.semana} (${rangoSemanaTexto(captura.anio, captura.semana)}) · sin horas ni tipo se guarda como sólo comida`}
            claseCuerpo="stack"
            estiloCuerpo={{ gap: 16 }}
          >
            <div className="row-2">
              <div className="field">
                <label className="label" htmlFor="num-horas">Horas</label>
                <input
                  id="num-horas" ref={horasRef} className="input mono" type="number" min="0" max="24" step="0.5" placeholder="0.0"
                  value={horasTexto} disabled={sinHE} onChange={cambio((e) => setHorasTexto(e.target.value))}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="fecha">Fecha <span className="required">*</span></label>
                <input id="fecha" className="input" type="date" max={fechaMaxima} value={fecha} onChange={cambio((e) => setFecha(e.target.value))} />
              </div>
            </div>
            <div className="field">
              <span className="label" id="tipo-label">Tipo de hora</span>
              <div className="tipo-grid" role="group" aria-labelledby="tipo-label">
                {tipos.map((t) => {
                  const clases = ['tipo-btn'];
                  if (tipo === t.clave) clases.push('selected');
                  if (domingo && esEspecial(t.clave) && !sinHE) clases.push('suggest');
                  return (
                    <button
                      key={t.clave} type="button" className={clases.join(' ')} disabled={sinHE}
                      aria-pressed={tipo === t.clave} onClick={cambio(() => setTipo((actual) => (actual === t.clave ? null : t.clave)))}
                    >
                      {t.etiqueta}<span className="tipo-tarifa">${tarifaDe(t.clave).tarifa}/hr</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {esSupervisor && !sinHE && (
              manual.activa ? (
                <div className="row-2">
                  <div className="field">
                    <label className="label" htmlFor="tarifa-manual">Tarifa manual ($/hr)</label>
                    <input id="tarifa-manual" className="input mono" type="number" min="0" step="0.5" value={manual.tarifa}
                      onChange={cambio((e) => setManual((m) => ({ ...m, tarifa: e.target.value })))} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="nota-manual">Motivo <span className="required">*</span></label>
                    <input id="nota-manual" className="input" type="text" placeholder="Ej. acordado con operaciones" value={manual.nota}
                      onChange={cambio((e) => setManual((m) => ({ ...m, nota: e.target.value })))} />
                  </div>
                  <button type="button" className="btn btn-ghost btn-xs" style={{ justifySelf: 'start' }} onClick={() => setManual(SIN_MANUAL)}>
                    Quitar tarifa manual
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost btn-xs" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setManual({ activa: true, tarifa: tipo ? String(tarifa) : '', nota: '' })}>
                  Usar tarifa manual…
                </button>
              )
            )}
            {domingo && (
              <Alerta tipo="info" icono="◆">
                Domingo — día de descanso. Usa <strong>Especial</strong>: ${tarifaEspecial}/hr personal fijo, ${Number(parametros.tarifa_domingo_eventual)}/hr eventual. Horex aplica la tarifa según el grupo.
              </Alerta>
            )}
          </Tarjeta>

          <Tarjeta titulo="Alimentos" subtitulo="Desayuno si entró a las 6:00 AM o antes · Cena si salió a las 10:00 PM o después">
            <div className="alimentos-grid">
              {ALIMENTOS.map((a) => (
                <div
                  key={a.clave}
                  className={alimentos[a.clave] ? 'alimento-toggle active' : 'alimento-toggle'}
                  role="button" tabIndex={0} aria-pressed={alimentos[a.clave]}
                  onClick={() => alternarAlimento(a.clave)}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternarAlimento(a.clave); } }}
                >
                  <span className="alimento-icon">{a.icono}</span>{a.texto}<span className="alimento-monto">{fmtMoneda(montoDe(a.clave))}</span>
                </div>
              ))}
            </div>
          </Tarjeta>
        </div>

        <div className="stack">
          <Tarjeta titulo={edicion ? 'Resumen del registro editado' : 'Resumen del registro'}>
            <div className="resumen-rows">
              <div className="resumen-row"><span className="r-label">Empleado</span><span className="r-value txt">{empleado ? nombreCorto(empleado.nombre) : '—'}</span></div>
              <div className="resumen-row"><span className="r-label">Fecha</span><span className="r-value txt">{fecha ? fechaLarga(fecha) : '—'}</span></div>
              <div className="resumen-row">
                <span className="r-label">Horas × tarifa</span>
                <span className="r-value">{sinHE ? 'No aplica' : soloComida ? 'Sólo comida' : horas && tarifa ? `${horas} × $${tarifa}` : '—'}</span>
              </div>
              <div className="resumen-row"><span className="r-label">Importe HE</span><span className="r-value">{fmtMoneda(importe)}</span></div>
              <div className="resumen-row">
                <span className="r-label">Alimentos{elegidos.length > 0 && <small className="faint"> · {elegidos.map((a) => `${a.texto} ${fmtMoneda(montoDe(a.clave))}`).join(' + ')}</small>}</span>
                <span className="r-value">{fmtMoneda(importeAlimentos)}</span>
              </div>
            </div>
            <div className="resumen-total"><span className="r-label">Total registro</span><span className="r-value">{fmtMoneda(importe + importeAlimentos)}</span></div>
            <div className="regla-note">{nota}</div>
            {comidasRepetidas.length > 0 && (
              <Alerta tipo="warn" estilo={{ marginTop: 8 }}>
                {comidasRepetidas.map((a) => a.texto).join(' y ')} ya {comidasRepetidas.length === 1 ? 'está' : 'están'} en otro registro de ese día: se pagaría dos veces.
              </Alerta>
            )}
            {error && <Alerta tipo="warn" estilo={{ marginTop: 8 }}>{error}</Alerta>}
            <button type="button" className="btn btn-primary btn-block" disabled={!valido} style={{ marginTop: 8 }} onClick={() => guardar()}>
              {edicion ? 'Guardar cambios' : 'Guardar registro'}
            </button>
            {!edicion && empleado && !sinHE && (
              <button type="button" className="btn btn-ghost btn-block" disabled={!valido} style={{ marginTop: 8 }} onClick={() => guardar(true)}>
                Guardar y capturar otro tipo
              </button>
            )}
            {edicion && (
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => navegar(-1)}>Cancelar</button>
            )}
          </Tarjeta>
          <Tarjeta titulo="Registros recientes" subtitulo="Últimos capturados">
            <div className="hist-list">
              {recientesQ.data.map((r) => (
                <div key={r.id} className={r.id === ultimoId ? 'hist-item new' : 'hist-item'}>
                  <div className={`hist-dot ${claseTipo(r.tipo_clave)}`} />
                  <div className="hist-info">
                    <div className="hist-name">{nombreCorto(r.nombre)}</div>
                    <div className="hist-meta">{r.tipo_etiqueta} · {r.horas ? `${fmtHoras(r.horas)} · ` : ''}{fechaCorta(r.fecha)}</div>
                  </div>
                  <div className="hist-monto">{fmtMoneda(r.total)}</div>
                </div>
              ))}
            </div>
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}
