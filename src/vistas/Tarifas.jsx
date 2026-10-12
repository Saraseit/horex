import { useState } from 'react';
import Alerta from '../componentes/Alerta.jsx';
import Cargando from '../componentes/Cargando.jsx';
import EncabezadoVista from '../componentes/EncabezadoVista.jsx';
import Insignia from '../componentes/Insignia.jsx';
import PildoraTipo from '../componentes/PildoraTipo.jsx';
import Tarjeta from '../componentes/Tarjeta.jsx';
import { useToast } from '../componentes/useToast.js';
import { useConteos, useEmpleados, useGuardarTarifas, useParametros, useTipos } from '../datos/consultas.js';
import { fmtMoneda, fmtTarifa } from '../logica/formato.js';
import { useSesion } from '../sesion/contexto.js';

const PENDIENTES = [
  'La hora 11, ¿se cuenta por jornada continua o acumulada en la semana?',
  'Si foránea y local cuestan igual, ¿qué las distingue y para qué se usa la diferencia?',
  '¿Cuándo aplica el almuerzo y es siempre de $50?',
  '¿El personal eventual cobra distinto los sábados o la hora 11+?',
  '¿Quién decide que una hora es "muerta" y con qué criterio?',
  '¿Hay registros confiables de checador con hora de entrada y salida?',
];

const porConfirmar = <Insignia variante="amber">Por confirmar</Insignia>;

export default function Tarifas() {
  const { esSupervisor } = useSesion();
  const tiposQ = useTipos();
  const parametrosQ = useParametros();
  const conteosQ = useConteos();
  const empleadosQ = useEmpleados();
  const consultas = [tiposQ, parametrosQ, conteosQ, empleadosQ];
  if (consultas.some((q) => q.isPending)) return <Cargando error={consultas.find((q) => q.error)?.error} />;

  const tipos = tiposQ.data;
  const parametros = parametrosQ.data;
  const tarifa = (clave) => Number(tipos.find((t) => t.clave === clave)?.tarifa ?? 0);
  // Puestos sin horas extra, en el orden en que aparecen en el catálogo.
  const puestosSinHE = [...new Set(empleadosQ.data.filter((e) => !e.genera_he).map((e) => e.puesto))];

  return (
    <section className="view">
      <EncabezadoVista titulo="Tarifas y reglas" subtitulo="Basado en los criterios de horas extra definidos por nómina" />
      {!esSupervisor && <Alerta tipo="amber" icono="🔒">Solo el supervisor puede modificar tarifas y reglas.</Alerta>}
      <div className="grid-3-1">
        {/* La key reinicia los campos cuando cambian las tarifas guardadas. */}
        <TiposDeHora key={tipos.map((t) => t.tarifa).join('|')} tipos={tipos} conteos={conteosQ.data.porTipo} editable={esSupervisor} />
        <Tarjeta titulo="Horario base">
          <div className="rule-list">
            <div className="rule"><span>Lunes a miércoles</span><b>8:00 – 17:00</b></div>
            <div className="rule"><span>Jueves a sábado</span><b>8:00 – 18:00</b></div>
            <div className="rule"><span>Domingo</span><b>Descanso</b></div>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>Lo trabajado fuera de este horario cuenta como hora extra.</div>
        </Tarjeta>
      </div>
      <div className="grid-2">
        <Tarjeta titulo="Matriz de tarifas" subtitulo="Según grupo y momento en que se genera la hora" conCuerpo={false}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Situación</th><th className="num">P. Fijo</th><th className="num">Eventual</th></tr></thead>
              <tbody>
                <tr><td>Entre semana, horas 1–10</td><td className="num">{fmtTarifa(tarifa('NORMAL_LOCAL'))}</td><td className="num">{fmtTarifa(tarifa('NORMAL_LOCAL'))}</td></tr>
                <tr><td>Entre semana, hora 11 en adelante</td><td className="num">{fmtTarifa(tarifa('ESPECIAL_LOCAL'))}</td><td className="num">{porConfirmar}</td></tr>
                <tr><td>Domingo</td><td className="num">{fmtTarifa(tarifa('ESPECIAL_LOCAL'))}</td><td className="num">{fmtTarifa(parametros.tarifa_domingo_eventual)}</td></tr>
                <tr><td>Hora muerta (normal)</td><td className="num">{fmtTarifa(tarifa('MUERTA'))}</td><td className="num">{fmtTarifa(tarifa('MUERTA'))}</td></tr>
                <tr><td>Hora muerta (hora 11+ o domingo)</td><td className="num">{fmtTarifa(tarifa('MUERTA_ESPECIAL'))}</td><td className="num">{porConfirmar}</td></tr>
              </tbody>
            </table>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Alimentos y excepciones">
          <div className="rule-list">
            <div className="rule"><span>Desayuno · entrada a las 6:00 AM o antes</span><b>{fmtMoneda(parametros.monto_alimento)}</b></div>
            <div className="rule"><span>Cena · salida a las 10:00 PM o después</span><b>{fmtMoneda(parametros.monto_alimento)}</b></div>
            <div className="rule"><span>Almuerzo · criterio por confirmar</span><b>{fmtMoneda(parametros.monto_alimento)}</b></div>
            {puestosSinHE.map((p) => <div key={p} className="rule"><span>{p}</span><b>Solo alimentos</b></div>)}
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Pendientes por confirmar con nómina" subtitulo="Necesarios antes de automatizar el cálculo con hora de entrada y salida">
        <ol className="q-list">{PENDIENTES.map((p) => <li key={p}>{p}</li>)}</ol>
      </Tarjeta>
    </section>
  );
}

function TiposDeHora({ tipos, conteos, editable }) {
  const toast = useToast();
  const guardar = useGuardarTarifas();
  const [valores, setValores] = useState(() => Object.fromEntries(tipos.map((t) => [t.clave, String(t.tarifa)])));

  function guardarCambios() {
    const cambios = Object.fromEntries(
      Object.entries(valores).map(([k, v]) => [k, parseFloat(v)]).filter(([, v]) => v >= 0),
    );
    guardar.mutate(cambios, {
      onSuccess: ({ cambiadas: n }) => toast(n
        ? `${n} tarifa${n > 1 ? 's' : ''} actualizada${n > 1 ? 's' : ''} · aplica a capturas nuevas`
        : 'Sin cambios'),
      onError: (e) => toast(e.message),
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-title">Tipos de hora</div><div className="card-subtitle">Tarifa base por hora</div></div>
        {editable && (
          <button type="button" className="btn btn-brand btn-xs" onClick={guardarCambios} disabled={guardar.isPending}>Guardar cambios</button>
        )}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Tipo</th><th>Cuándo aplica</th><th className="num">Tarifa / hr</th><th className="num">Registros</th></tr></thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.clave}>
                <td><PildoraTipo clave={t.clave} etiqueta={t.etiqueta} /></td>
                <td className="muted" style={{ whiteSpace: 'normal', minWidth: 180 }}>{t.descripcion}</td>
                <td className="num">
                  <input
                    className="input sm tarifa-input" type="number" min="0" step="5" aria-label={`Tarifa ${t.etiqueta}`}
                    value={valores[t.clave]} disabled={!editable}
                    onChange={(e) => setValores((v) => ({ ...v, [t.clave]: e.target.value }))}
                  />
                </td>
                <td className="num">{conteos[t.clave] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-body" style={{ paddingTop: 12 }}>
        <div className="faint" style={{ fontSize: 12 }}>
          Cada registro guarda la tarifa vigente al capturarlo. Cambiar una tarifa aquí solo afecta capturas nuevas; los registros ya guardados no se recalculan.
        </div>
      </div>
    </div>
  );
}
