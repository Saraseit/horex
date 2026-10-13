import { useEffect, useRef, useState } from 'react';
import Alerta from '../componentes/Alerta.jsx';
import BuscadorEmpleado from '../componentes/BuscadorEmpleado.jsx';
import Cargando from '../componentes/Cargando.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { useToast } from '../componentes/useToast.js';
import {
  useCrearRegistro, useEmpleados, useParametros, useRegistrosDia, useRegistrosRecientes, useTipos,
} from '../datos/consultas.js';
import { esDomingo, hoy } from '../logica/fechas.js';
import { fechaCorta, fechaLarga, fmtHoras, fmtMoneda, nombreCorto, siNo } from '../logica/formato.js';
import { useSesion } from '../sesion/contexto.js';
import { calcularTarifa, claseTipo, esEspecial, notaRegla } from '../logica/reglas.js';

const ALIMENTOS = [
  { clave: 'desayuno', icono: '☕', texto: 'Desayuno' },
  { clave: 'almuerzo', icono: '🥗', texto: 'Almuerzo' },
  { clave: 'cena', icono: '🌙', texto: 'Cena' },
];
const SIN_ALIMENTOS = { desayuno: false, almuerzo: false, cena: false };

export default function Registrar() {
  const toast = useToast();
  const empleadosQ = useEmpleados();
  const tiposQ = useTipos();
  const parametrosQ = useParametros();
  const recientesQ = useRegistrosRecientes(7);
  const crear = useCrearRegistro();
  const { esSupervisor } = useSesion();
  const hoyF = hoy();

  const [empleado, setEmpleado] = useState(null);
  const [horasTexto, setHorasTexto] = useState('');
  const [tipo, setTipo] = useState(null);
  const [fecha, setFecha] = useState(hoyF);
  const [alimentos, setAlimentos] = useState(SIN_ALIMENTOS);
  // Tarifa manual (sólo supervisor): excepción con nota obligatoria; la base la valida otra vez.
  const [manual, setManual] = useState({ activa: false, tarifa: '', nota: '' });
  const [error, setError] = useState('');
  const [ultimoId, setUltimoId] = useState(null);
  const [vueltaBuscador, setVueltaBuscador] = useState(0);
  const buscadorRef = useRef(null);
  const horasRef = useRef(null);
  const delDiaQ = useRegistrosDia(empleado?.id, fecha);

  // Al elegir empleado el foco pasa a Horas; después de guardar, de vuelta al buscador.
  useEffect(() => { if (empleado?.genera_he) horasRef.current?.focus(); }, [empleado]);
  useEffect(() => { if (vueltaBuscador) buscadorRef.current?.focus(); }, [vueltaBuscador]);

  const consultas = [empleadosQ, tiposQ, parametrosQ, recientesQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;
  const tipos = tiposQ.data;
  const parametros = parametrosQ.data;

  const sinHE = !!empleado && !empleado.genera_he;
  // Sin empleado (o si no genera HE) los botones muestran la tarifa base del tipo, como la demo.
  const tarifaDe = (clave) => (!empleado || sinHE
    ? { tarifa: Number(tipos.find((t) => t.clave === clave).tarifa), regla: null }
    : calcularTarifa({ empleado, fecha, tipoClave: clave, tipos, parametros }));
  const usaManual = manual.activa && !sinHE;
  const tarifaManual = parseFloat(manual.tarifa);
  const { tarifa, regla } = tipo && !sinHE
    ? (usaManual ? { tarifa: Number.isFinite(tarifaManual) ? tarifaManual : 0, regla: null } : tarifaDe(tipo))
    : { tarifa: 0, regla: null };
  const horas = sinHE ? 0 : parseFloat(horasTexto) || 0;
  const importe = horas * tarifa;
  const montoDe = (clave) => Number(parametros[`monto_${clave}`] ?? 0);
  const elegidos = ALIMENTOS.filter((a) => alimentos[a.clave]);
  const importeAlimentos = elegidos.reduce((t, a) => t + montoDe(a.clave), 0);
  const manualValida = !usaManual || (Number.isFinite(tarifaManual) && tarifaManual >= 0 && manual.nota.trim() !== '');
  const domingo = esDomingo(fecha);
  const tarifaEspecial = Number(tipos.find((t) => t.clave === 'ESPECIAL_LOCAL')?.tarifa ?? 0);
  const duplicado = !!empleado && (delDiaQ.data?.length ?? 0) > 0;
  const valido = !!empleado && !!fecha && fecha <= hoyF && !crear.isPending
    && (sinHE ? importeAlimentos > 0 : horas > 0 && horas <= 16 && !!tipo && manualValida);

  const cambio = (fn) => (...args) => { setError(''); fn(...args); };

  function seleccionar(e) {
    setError('');
    setEmpleado(e);
    if (!e.genera_he) { setTipo(null); setHorasTexto(''); }
  }

  function guardar() {
    crear.mutate({
      empleado_id: empleado.id,
      fecha,
      tipo_clave: sinHE ? null : tipo,
      horas: sinHE ? 0 : horas,
      ...alimentos,
      ...(usaManual && { tarifa_manual: true, tarifa_aplicada: tarifaManual, nota: manual.nota.trim() }),
    }, {
      onSuccess: (r) => {
        setUltimoId(r.id);
        toast(`Guardado: ${nombreCorto(empleado.nombre)} · ${fmtMoneda(r.total)}`);
        setEmpleado(null);
        setHorasTexto('');
        setTipo(null);
        setAlimentos(SIN_ALIMENTOS);
        setManual({ activa: false, tarifa: '', nota: '' });
        setVueltaBuscador((v) => v + 1);
      },
      onError: (e) => setError(e.message),
    });
  }

  const alternarAlimento = (clave) => { setError(''); setAlimentos((a) => ({ ...a, [clave]: !a[clave] })); };

  return (
    <section className="view">
      <div className="capture-grid">
        <div className="stack">
          <Tarjeta titulo="Empleado" subtitulo="Escribe al menos 2 letras del nombre o apellido" claseCuerpo="stack" estiloCuerpo={{ gap: 14 }}>
            <div className="field">
              <label className="label" htmlFor="emp-search">Empleado <span className="required">*</span></label>
              <BuscadorEmpleado
                key={vueltaBuscador}
                id="emp-search"
                inputRef={buscadorRef}
                empleados={empleadosQ.data}
                seleccionado={empleado}
                alSeleccionar={seleccionar}
                alDeseleccionar={cambio(() => setEmpleado(null))}
                placeholder="Ej. Nah, Cortes, Gamboa…"
              />
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
            {duplicado && (
              <Alerta tipo="warn">
                <strong>{nombreCorto(empleado.nombre)}</strong> ya tiene un registro el {fechaLarga(fecha)}. Revisa en <em>Semana actual</em> antes de guardar.
              </Alerta>
            )}
          </Tarjeta>

          <Tarjeta titulo="Horas extra" claseCuerpo="stack" estiloCuerpo={{ gap: 16 }}>
            <div className="row-2">
              <div className="field">
                <label className="label" htmlFor="num-horas">Horas <span className="required">*</span></label>
                <input
                  id="num-horas" ref={horasRef} className="input mono" type="number" min="0" max="16" step="0.5" placeholder="0.0"
                  value={horasTexto} disabled={sinHE} onChange={cambio((e) => setHorasTexto(e.target.value))}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="fecha">Fecha <span className="required">*</span></label>
                <input id="fecha" className="input" type="date" max={hoyF} value={fecha} onChange={cambio((e) => setFecha(e.target.value))} />
              </div>
            </div>
            <div className="field">
              <span className="label" id="tipo-label">Tipo de hora <span className="required">*</span></span>
              <div className="tipo-grid" role="group" aria-labelledby="tipo-label">
                {tipos.map((t) => {
                  const clases = ['tipo-btn'];
                  if (tipo === t.clave) clases.push('selected');
                  if (domingo && esEspecial(t.clave) && !sinHE) clases.push('suggest');
                  return (
                    <button
                      key={t.clave} type="button" className={clases.join(' ')} disabled={sinHE}
                      aria-pressed={tipo === t.clave} onClick={cambio(() => setTipo(t.clave))}
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
                  <button type="button" className="btn btn-ghost btn-xs" style={{ justifySelf: 'start' }} onClick={() => setManual({ activa: false, tarifa: '', nota: '' })}>
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
          <Tarjeta titulo="Resumen del registro">
            <div className="resumen-rows">
              <div className="resumen-row"><span className="r-label">Empleado</span><span className="r-value txt">{empleado ? nombreCorto(empleado.nombre) : '—'}</span></div>
              <div className="resumen-row"><span className="r-label">Fecha</span><span className="r-value txt">{fecha ? fechaLarga(fecha) : '—'}</span></div>
              <div className="resumen-row"><span className="r-label">Horas × tarifa</span><span className="r-value">{sinHE ? 'No aplica' : horas && tarifa ? `${horas} × $${tarifa}` : '—'}</span></div>
              <div className="resumen-row"><span className="r-label">Importe HE</span><span className="r-value">{fmtMoneda(importe)}</span></div>
              <div className="resumen-row">
                <span className="r-label">Alimentos{elegidos.length > 0 && <small className="faint"> · {elegidos.map((a) => `${a.texto} ${fmtMoneda(montoDe(a.clave))}`).join(' + ')}</small>}</span>
                <span className="r-value">{fmtMoneda(importeAlimentos)}</span>
              </div>
            </div>
            <div className="resumen-total"><span className="r-label">Total registro</span><span className="r-value">{fmtMoneda(importe + importeAlimentos)}</span></div>
            <div className="regla-note">{usaManual ? 'Tarifa manual (queda marcada en los reportes con su nota)' : notaRegla({ tarifa, regla, tipoClave: tipo, fecha })}</div>
            {error && <Alerta tipo="warn" estilo={{ marginTop: 8 }}>{error}</Alerta>}
            <button type="button" className="btn btn-primary btn-block" disabled={!valido} style={{ marginTop: 8 }} onClick={guardar}>
              Guardar registro
            </button>
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
