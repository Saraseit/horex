// Rutas de datos. Cada petición corre en la transacción del usuario: RLS y los triggers deciden;
// las validaciones de aquí sólo dan mensajes claros antes de llegar a la base.
import express from 'express';
import { ErrorHttp } from './errores.js';

const envolver = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Una jornada puede ser de hasta 24 horas seguidas (migración 0006).
const HORAS_MAXIMAS = 24;
const PARAMETROS = ['monto_desayuno', 'monto_almuerzo', 'monto_cena', 'tarifa_domingo_eventual'];

const entero = (v, nombre) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorHttp(400, `${nombre} no válido.`);
  return n;
};
const monto = (v, nombre) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new ErrorHttp(400, `${nombre}: escribe un monto válido.`);
  return Math.round(n * 100) / 100;
};
const exigirSupervisor = (req) => {
  if (req.usuario.rol !== 'SUPERVISOR') throw new ErrorHttp(403, 'Solo el supervisor puede hacer esto.');
};

export function rutasDatos(bd) {
  const r = express.Router();
  const como = (req, fn) => bd.transaccion(req.usuario.id, fn);

  // ── Empleados ──
  r.get('/empleados', envolver(async (req, res) => {
    res.json(await como(req, async (c) => (await c.query(
      'select id, nombre, puesto, grupo, reclutador, imss, genera_he, activo from empleados order by id',
    )).rows));
  }));

  r.post('/empleados', envolver(async (req, res) => {
    exigirSupervisor(req);
    const { nombre, puesto, grupo, imss, genera_he } = req.body ?? {};
    const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ');
    if (!limpio || !String(puesto ?? '').trim()) throw new ErrorHttp(400, 'Escribe el nombre completo y el puesto.');
    if (!['P. Fijo', 'Eventual'].includes(grupo)) throw new ErrorHttp(400, 'Grupo no válido.');
    try {
      const fila = await como(req, async (c) => (await c.query(
        `insert into empleados (nombre, puesto, grupo, reclutador, imss, genera_he) values ($1, $2, $3, $4, $5, $6)
         returning id, nombre, puesto, grupo, reclutador, imss, genera_he, activo`,
        [limpio, String(puesto).trim(), grupo, grupo === 'Eventual' ? 'EVENTUAL' : 'FIJO', !!imss, !!genera_he],
      )).rows[0]);
      res.status(201).json(fila);
    } catch (e) {
      if (e.code === '23505') throw new ErrorHttp(409, 'Ya existe un empleado con ese nombre');
      throw e;
    }
  }));

  r.patch('/empleados/:id', envolver(async (req, res) => {
    exigirSupervisor(req);
    const id = entero(req.params.id, 'Empleado');
    const fila = await como(req, async (c) => (await c.query(
      'update empleados set activo = $2 where id = $1 returning id, nombre, puesto, grupo, reclutador, imss, genera_he, activo',
      [id, !!req.body?.activo],
    )).rows[0]);
    if (!fila) throw new ErrorHttp(404, 'El empleado no existe.');
    res.json(fila);
  }));

  // ── Tarifas y parámetros ──
  r.get('/tipos', envolver(async (req, res) => {
    res.json(await como(req, async (c) => (await c.query(
      'select clave, etiqueta, tarifa, descripcion, orden from tipos_hora order by orden',
    )).rows));
  }));

  r.patch('/tipos', envolver(async (req, res) => {
    exigirSupervisor(req);
    const cambios = Object.entries(req.body?.cambios ?? {}).map(([clave, v]) => [clave, monto(v, clave)]);
    const cambiadas = await como(req, async (c) => {
      let n = 0;
      for (const [clave, tarifa] of cambios) {
        n += (await c.query('update tipos_hora set tarifa = $2 where clave = $1 and tarifa <> $2', [clave, tarifa])).rowCount;
      }
      return n;
    });
    res.json({ cambiadas });
  }));

  r.get('/parametros', envolver(async (req, res) => {
    const filas = await como(req, async (c) => (await c.query('select clave, valor from parametros')).rows);
    res.json(Object.fromEntries(filas.map((f) => [f.clave, f.valor])));
  }));

  r.patch('/parametros', envolver(async (req, res) => {
    exigirSupervisor(req);
    const cambios = Object.entries(req.body?.cambios ?? {});
    if (cambios.some(([clave]) => !PARAMETROS.includes(clave))) throw new ErrorHttp(400, 'Parámetro desconocido.');
    const cambiados = await como(req, async (c) => {
      let n = 0;
      for (const [clave, v] of cambios) {
        n += (await c.query('update parametros set valor = $2 where clave = $1 and valor <> $2', [clave, monto(v, clave)])).rowCount;
      }
      return n;
    });
    res.json({ cambiados });
  }));

  // ── Registros ──
  r.get('/registros', envolver(async (req, res) => {
    const { desde, hasta, anio, semana, empleado } = req.query;
    const condiciones = [];
    const valores = [];
    const agregar = (sql, v) => { valores.push(v); condiciones.push(sql.replace('?', `$${valores.length}`)); };
    if (desde) { if (!FECHA.test(desde)) throw new ErrorHttp(400, 'Fecha no válida.'); agregar('fecha >= ?', desde); }
    if (hasta) { if (!FECHA.test(hasta)) throw new ErrorHttp(400, 'Fecha no válida.'); agregar('fecha <= ?', hasta); }
    if (anio || semana) { agregar('anio_iso = ?', entero(anio, 'Año')); agregar('semana = ?', entero(semana, 'Semana')); }
    if (empleado) agregar('empleado_id = ?', entero(empleado, 'Empleado'));
    const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';
    res.json(await como(req, async (c) => (await c.query(`select * from v_registros ${where} order by id`, valores)).rows));
  }));

  r.get('/registros/recientes', envolver(async (req, res) => {
    const limite = Math.min(50, entero(req.query.limite ?? 7, 'Límite'));
    res.json(await como(req, async (c) => (await c.query(
      'select * from v_registros order by created_at desc, id desc limit $1', [limite],
    )).rows));
  }));

  r.get('/registros/semanas', envolver(async (req, res) => {
    res.json(await como(req, async (c) => (await c.query(
      'select distinct anio_iso as anio, semana from v_registros order by anio, semana',
    )).rows));
  }));

  r.get('/registros/conteos', envolver(async (req, res) => {
    const [porEmpleado, porTipo] = await como(req, async (c) => [
      (await c.query('select empleado_id, count(*)::int n from v_registros group by empleado_id')).rows,
      (await c.query('select tipo_clave, count(*)::int n from v_registros where tipo_clave is not null group by tipo_clave')).rows,
    ]);
    res.json({
      porEmpleado: Object.fromEntries(porEmpleado.map((f) => [f.empleado_id, f.n])),
      porTipo: Object.fromEntries(porTipo.map((f) => [f.tipo_clave, f.n])),
    });
  }));

  // Va después de /registros/recientes, /semanas y /conteos para no confundirlas con un id.
  r.get('/registros/:id', envolver(async (req, res) => {
    const id = entero(req.params.id, 'Registro');
    const fila = await como(req, async (c) => (await c.query('select * from v_registros where id = $1', [id])).rows[0]);
    if (!fila) throw new ErrorHttp(404, 'El registro no existe o fue eliminado.');
    res.json(fila);
  }));

  // Edición (sólo supervisor): fecha, tipo, horas, comidas y tarifa manual. El empleado no cambia.
  r.patch('/registros/:id', envolver(async (req, res) => {
    exigirSupervisor(req);
    const id = entero(req.params.id, 'Registro');
    const d = req.body ?? {};
    if (!FECHA.test(d.fecha ?? '')) throw new ErrorHttp(400, 'Fecha no válida.');
    const horas = Number(d.horas ?? 0);
    if (!Number.isFinite(horas) || horas < 0 || horas > HORAS_MAXIMAS) throw new ErrorHttp(400, `Las horas deben estar entre 0 y ${HORAS_MAXIMAS}.`);
    const manual = !!d.tarifa_manual;
    const fila = await como(req, async (c) => {
      const { rowCount } = await c.query(
        `update registros_horas set fecha = $2, tipo_clave = $3, horas = $4, tarifa_aplicada = $5, tarifa_manual = $6,
           nota = $7, desayuno = $8, almuerzo = $9, cena = $10
         where id = $1 and eliminado_at is null`,
        [id, d.fecha, d.tipo_clave || null, d.tipo_clave ? horas : 0, manual ? monto(d.tarifa_aplicada, 'Tarifa') : 0, manual,
          manual ? String(d.nota ?? '').trim() : null, !!d.desayuno, !!d.almuerzo, !!d.cena],
      );
      if (!rowCount) throw new ErrorHttp(404, 'El registro no existe o fue eliminado.');
      return (await c.query('select * from v_registros where id = $1', [id])).rows[0];
    });
    res.json(fila);
  }));

  r.post('/registros', envolver(async (req, res) => {
    const d = req.body ?? {};
    if (!FECHA.test(d.fecha ?? '')) throw new ErrorHttp(400, 'Fecha no válida.');
    const horas = Number(d.horas ?? 0);
    if (!Number.isFinite(horas) || horas < 0 || horas > HORAS_MAXIMAS) throw new ErrorHttp(400, `Las horas deben estar entre 0 y ${HORAS_MAXIMAS}.`);
    const manual = !!d.tarifa_manual;
    if (manual) exigirSupervisor(req);
    const fila = await como(req, async (c) => {
      const { rows: [{ id }] } = await c.query(
        `insert into registros_horas (empleado_id, fecha, tipo_clave, horas, tarifa_aplicada, tarifa_manual, nota, desayuno, almuerzo, cena)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
        [entero(d.empleado_id, 'Empleado'), d.fecha, d.tipo_clave || null, horas,
          manual ? monto(d.tarifa_aplicada, 'Tarifa') : 0, manual, manual ? String(d.nota ?? '').trim() : null,
          !!d.desayuno, !!d.almuerzo, !!d.cena],
      );
      return (await c.query('select * from v_registros where id = $1', [id])).rows[0];
    });
    res.status(201).json(fila);
  }));

  // Borrado lógico de uno o varios registros: todo o nada.
  r.post('/registros/eliminar', envolver(async (req, res) => {
    exigirSupervisor(req);
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000) throw new ErrorHttp(400, 'No hay registros seleccionados.');
    const lista = [...new Set(ids.map((i) => entero(i, 'Registro')))];
    const eliminados = await como(req, async (c) => {
      const { rowCount } = await c.query(
        'update registros_horas set eliminado_at = now() where id = any($1::bigint[]) and eliminado_at is null',
        [lista],
      );
      if (rowCount !== lista.length) throw new ErrorHttp(409, 'Alguno de los registros ya no existe. Recarga e inténtalo de nuevo.');
      return rowCount;
    });
    res.json({ eliminados });
  }));

  // ── Semanas cerradas ──
  r.get('/semanas-cerradas', envolver(async (req, res) => {
    res.json(await como(req, async (c) => (await c.query(
      `select s.anio_iso, s.semana, s.cerrada_at, u.nombre as cerrada_por_nombre
       from semanas_cerradas s join usuarios u on u.id = s.cerrada_por order by s.anio_iso, s.semana`,
    )).rows));
  }));

  r.post('/semanas-cerradas', envolver(async (req, res) => {
    exigirSupervisor(req);
    const anio = entero(req.body?.anio, 'Año');
    const semana = entero(req.body?.semana, 'Semana');
    try {
      await como(req, (c) => c.query('insert into semanas_cerradas (anio_iso, semana) values ($1, $2)', [anio, semana]));
    } catch (e) {
      if (e.code === '23505') throw new ErrorHttp(409, `La semana ${semana} ya estaba cerrada.`);
      throw e;
    }
    res.status(201).json({ anio, semana });
  }));

  return r;
}
