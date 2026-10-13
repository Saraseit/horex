// Pruebas de la base (Fase 2) contra la rama "desarrollo" de Neon, conectadas como horex_api: el mismo rol
// y los mismos permisos que usa la API. Cada prueba corre en una transacción que se deshace al final.
// Se saltan si .env no tiene DATABASE_URL_DESARROLLO_API y DATABASE_URL_DESARROLLO_DIRECTA.
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CASOS_TARIFA, FECHAS } from '../../src/logica/casosTarifa.js';

try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* sin .env */ }
const URL_API = process.env.DATABASE_URL_DESARROLLO_API;
const URL_DUENO = process.env.DATABASE_URL_DESARROLLO_DIRECTA;

const TARIFAS_BASE = { NORMAL_LOCAL: 60, NORMAL_FORANEA: 60, ESPECIAL_LOCAL: 80, ESPECIAL_FORANEA: 80, MUERTA: 30, MUERTA_ESPECIAL: 40 };
const NOMBRES = {
  fijo: 'Yahir Antonio Nah Molina',
  eventual: 'Bryan Silveira',
  sinHE: 'Gerardo Jose Itza Poot',
  inactivo: 'Raul Ernesto Pech Canul',
};

describe.skipIf(!URL_API || !URL_DUENO)('base de datos (rama desarrollo, como horex_api)', () => {
  let api;
  const usuario = {};
  const empleado = {};

  beforeAll(async () => {
    api = new pg.Pool({ connectionString: URL_API, max: 4 });
    const dueno = new pg.Client({ connectionString: URL_DUENO });
    await dueno.connect();
    const { rows: u } = await dueno.query("select split_part(correo, '@', 1) clave, id from usuarios where correo like '%@prueba.horex'");
    u.forEach((r) => { usuario[r.clave] = r.id; });
    const { rows: e } = await dueno.query('select id, nombre from empleados');
    for (const [clave, nombre] of Object.entries(NOMBRES)) empleado[clave] = e.find((x) => x.nombre === nombre)?.id;
    await dueno.end();
    if (!usuario.supervisor || !usuario.capturista || !empleado.inactivo) {
      throw new Error('Faltan los datos de prueba: corre `node scripts/semilla-demo.js --destino desarrollo`');
    }
  });
  afterAll(() => api?.end());

  /** Corre fn como ese usuario dentro de una transacción que siempre se deshace. Tarifas y parámetros en su valor base. */
  async function como(usuarioId, fn) {
    const c = await api.connect();
    try {
      await c.query('begin');
      // Como supervisor: tarifas y parámetros en su valor base (por si alguien los cambió en desarrollo).
      await c.query(`select set_config('horex.usuario_id', $1, true);
        update tipos_hora t set tarifa = (($2::json) ->> t.clave)::numeric;
        update parametros set valor = case clave when 'monto_desayuno' then 60 when 'monto_almuerzo' then 50 when 'monto_cena' then 70 when 'tarifa_domingo_eventual' then 70 end;`
        .replace('$1', `'${usuario.supervisor}'`).replace('$2', `'${JSON.stringify(TARIFAS_BASE)}'`));
      await c.query("select set_config('horex.usuario_id', $1, true)", [usuarioId ?? '']);
      return await fn(c);
    } finally {
      await c.query('rollback');
      c.release();
    }
  }

  /** Ejecuta una consulta que puede fallar sin abortar la transacción. Devuelve { filas, n } o { error }. */
  async function intentar(c, sql, params) {
    await c.query('savepoint intento');
    try {
      const r = await c.query(sql, params);
      await c.query('release savepoint intento');
      return { filas: r.rows, n: r.rowCount };
    } catch (error) {
      await c.query('rollback to savepoint intento');
      return { error };
    }
  }

  const insertar = (c, datos) => intentar(
    c,
    `insert into registros_horas (empleado_id, fecha, tipo_clave, horas, tarifa_aplicada, tarifa_manual, nota, desayuno, almuerzo, cena)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
    [datos.empleado_id, datos.fecha, datos.tipo_clave ?? null, datos.horas ?? 0, datos.tarifa_aplicada ?? 0,
      datos.tarifa_manual ?? false, datos.nota ?? null, !!datos.desayuno, !!datos.almuerzo, !!datos.cena],
  );

  describe('calcular_tarifa: los mismos casos que reglas.js', () => {
    it.each(CASOS_TARIFA)('%s → $%i', (_, grupo, fecha, tipo, esperada) => como(usuario.capturista, async (c) => {
      const id = grupo === 'Eventual' ? empleado.eventual : empleado.fijo;
      const { rows: [r] } = await c.query('select calcular_tarifa($1, $2, $3)::float t', [id, fecha, tipo]);
      expect(r.t).toBe(esperada);
    }));

    it('puesto sin horas extra y "Solo alimentos" dan 0', () => como(usuario.capturista, async (c) => {
      const { rows: [r] } = await c.query('select calcular_tarifa($1, $2, $3)::float a, calcular_tarifa($4, $2, null)::float b',
        [empleado.sinHE, FECHAS.LUNES, 'ESPECIAL_LOCAL', empleado.fijo]);
      expect(r).toEqual({ a: 0, b: 0 });
    }));
  });

  describe('captura', () => {
    it('ignora la tarifa que manda el cliente y fija alimentos y capturista', () => como(usuario.capturista, async (c) => {
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 2, tarifa_aplicada: 999, cena: true });
      expect(Number(r.tarifa_aplicada)).toBe(60);
      expect(Number(r.importe_cena)).toBe(70);
      expect(Number(r.total)).toBe(190);
      expect(r.capturado_por).toBe(usuario.capturista);
      expect(r.tarifa_manual).toBe(false);
    }));

    it('domingo, eventual, especial = $70', () => como(usuario.capturista, async (c) => {
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.eventual, fecha: FECHAS.DOMINGO, tipo_clave: 'ESPECIAL_LOCAL', horas: 4 });
      expect(Number(r.tarifa_aplicada)).toBe(70);
      expect(Number(r.importe_he)).toBe(280);
    }));

    it('puesto sin horas extra: tipo, horas y tarifa forzados a 0, conserva alimentos', () => como(usuario.capturista, async (c) => {
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.sinHE, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 3, tarifa_aplicada: 60, desayuno: true });
      expect(r.tipo_clave).toBeNull();
      expect(Number(r.horas)).toBe(0);
      expect(Number(r.tarifa_aplicada)).toBe(0);
      expect(Number(r.total)).toBe(60);
    }));

    it('cada comida usa su propio monto vigente y lo guarda', () => como(usuario.supervisor, async (c) => {
      await c.query("update parametros set valor = 65 where clave = 'monto_almuerzo'");
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1, desayuno: true, almuerzo: true, cena: true });
      expect([r.importe_desayuno, r.importe_almuerzo, r.importe_cena, r.importe_alimentos, r.total].map(Number)).toEqual([60, 65, 70, 195, 255]);
      await c.query("update parametros set valor = 80 where clave = 'monto_cena'");
      const { rows: [g] } = await c.query('select importe_cena from registros_horas where id = $1', [r.id]);
      expect(Number(g.importe_cena)).toBe(70);
    }));

    it('una semana cerrada no acepta registros', () => como(usuario.supervisor, async (c) => {
      const { error } = await insertar(c, { empleado_id: empleado.fijo, fecha: '2026-09-30', tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(error?.message).toMatch(/semana 40 está cerrada/);
    }));

    it('rechaza fechas futuras (hora de Mérida)', () => como(usuario.capturista, async (c) => {
      const { rows: [{ manana }] } = await c.query("select to_char(hoy_merida() + 1, 'YYYY-MM-DD') manana");
      const { error } = await insertar(c, { empleado_id: empleado.fijo, fecha: manana, tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(error?.message).toMatch(/fechas futuras/);
    }));

    it('rechaza empleados inactivos', () => como(usuario.capturista, async (c) => {
      const { error } = await insertar(c, { empleado_id: empleado.inactivo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(error?.message).toMatch(/inactivo/);
    }));

    it('rechaza horas sin tipo y registros sin horas ni alimentos', () => como(usuario.capturista, async (c) => {
      expect((await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, horas: 2, desayuno: true })).error).toBeDefined();
      expect((await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES })).error).toBeDefined();
      expect((await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 17 })).error).toBeDefined();
    }));
  });

  describe('tarifa manual (opción del supervisor)', () => {
    it('el supervisor la pone con nota y se respeta', () => como(usuario.supervisor, async (c) => {
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1, tarifa_aplicada: 90, tarifa_manual: true, nota: 'Ajuste acordado con operaciones' });
      expect(Number(r.tarifa_aplicada)).toBe(90);
      expect(r.tarifa_manual).toBe(true);
    }));

    it('sin nota se rechaza', () => como(usuario.supervisor, async (c) => {
      const { error } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1, tarifa_aplicada: 90, tarifa_manual: true, nota: '  ' });
      expect(error?.message).toMatch(/nota/);
    }));

    it('la capturista no puede ponerla', () => como(usuario.capturista, async (c) => {
      const { error } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1, tarifa_aplicada: 90, tarifa_manual: true, nota: 'x' });
      expect(error?.message).toMatch(/Solo el supervisor/);
    }));
  });

  describe('permisos de la capturista', () => {
    it('no puede eliminar registros', () => como(usuario.capturista, async (c) => {
      const { rows: [r] } = await c.query('select id from v_registros where anio_iso = 2026 and semana = 41 limit 1');
      const { n } = await intentar(c, 'update registros_horas set eliminado_at = now() where id = $1', [r.id]);
      expect(n).toBe(0);
    }));

    it('no puede editar tarifas, parámetros ni empleados, ni cerrar semanas', () => como(usuario.capturista, async (c) => {
      expect((await intentar(c, "update tipos_hora set tarifa = 1 where clave = 'NORMAL_LOCAL'")).n).toBe(0);
      expect((await intentar(c, "update parametros set valor = 1 where clave = 'monto_cena'")).n).toBe(0);
      expect((await intentar(c, 'update empleados set activo = false where id = $1', [empleado.fijo])).n).toBe(0);
      expect((await intentar(c, "insert into empleados (nombre, puesto, grupo, reclutador) values ('Prueba Nueva', 'Operador cargador', 'Eventual', 'EVENTUAL')")).error?.message).toMatch(/row-level security/);
      expect((await intentar(c, 'insert into semanas_cerradas (anio_iso, semana) values (2026, 41)')).error?.message).toMatch(/row-level security/);
    }));

    it('nadie puede borrar filas físicamente ni leer contraseñas', () => como(usuario.supervisor, async (c) => {
      expect((await intentar(c, 'delete from registros_horas')).error?.message).toMatch(/permission denied/);
      expect((await intentar(c, 'delete from empleados')).error?.message).toMatch(/permission denied/);
      expect((await intentar(c, 'select * from credenciales')).error?.message).toMatch(/permission denied/);
      expect((await intentar(c, 'select correo from usuarios')).error?.message).toMatch(/permission denied/);
    }));
  });

  describe('borrado lógico (supervisor)', () => {
    it('elimina en semana abierta y deja de verse en v_registros', () => como(usuario.supervisor, async (c) => {
      const { rows: [r] } = await c.query('select id from v_registros where anio_iso = 2026 and semana = 41 order by id limit 1');
      const { filas: [b] } = await intentar(c, 'update registros_horas set eliminado_at = now() where id = $1 returning eliminado_por', [r.id]);
      expect(b.eliminado_por).toBe(usuario.supervisor);
      const { rows: [v] } = await c.query('select count(*)::int n from v_registros where id = $1', [r.id]);
      expect(v.n).toBe(0);
    }));

    it('también elimina en semana cerrada (pedido del usuario: el supervisor borra cualquier registro)', () => como(usuario.supervisor, async (c) => {
      const { rows: [r] } = await c.query('select id from v_registros where anio_iso = 2026 and semana = 40 limit 1');
      const { n } = await intentar(c, 'update registros_horas set eliminado_at = now() where id = $1', [r.id]);
      expect(n).toBe(1);
    }));

    it('la capturista tampoco puede eliminar en semana cerrada', () => como(usuario.capturista, async (c) => {
      const { rows: [r] } = await c.query('select id from v_registros where anio_iso = 2026 and semana = 40 limit 1');
      const { n } = await intentar(c, 'update registros_horas set eliminado_at = now() where id = $1', [r.id]);
      expect(n).toBe(0);
    }));

  });

  describe('edición (supervisor)', () => {
    const nuevo = (c, datos) => insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 2, ...datos });

    it('corrige horas y agrega una comida: conserva tarifa y montos de la captura', () => como(usuario.supervisor, async (c) => {
      const { filas: [r] } = await nuevo(c, {});
      await c.query("update tipos_hora set tarifa = 99 where clave = 'NORMAL_LOCAL'");
      await c.query("update parametros set valor = 99 where clave = 'monto_cena'");
      const { filas: [e] } = await intentar(c, 'update registros_horas set horas = 3, cena = true where id = $1 returning *', [r.id]);
      expect([e.horas, e.tarifa_aplicada, e.importe_cena, e.total].map(Number)).toEqual([3, 60, 70, 250]);
      expect(e.editado_por).toBe(usuario.supervisor);
      expect(e.editado_at).not.toBeNull();
    }));

    it('si cambia el tipo o la fecha, recalcula la tarifa con la regla', () => como(usuario.supervisor, async (c) => {
      const { filas: [r] } = await nuevo(c, {});
      const { filas: [e] } = await intentar(c, "update registros_horas set tipo_clave = 'ESPECIAL_LOCAL' where id = $1 returning tarifa_aplicada", [r.id]);
      expect(Number(e.tarifa_aplicada)).toBe(80);
    }));

    it('sin tipo de hora queda como sólo alimentos', () => como(usuario.supervisor, async (c) => {
      const { filas: [r] } = await nuevo(c, {});
      const { filas: [e] } = await intentar(c, 'update registros_horas set tipo_clave = null, desayuno = true where id = $1 returning *', [r.id]);
      expect([e.tipo_clave, Number(e.horas), Number(e.total)]).toEqual([null, 0, 60]);
    }));

    it('no cambia el empleado ni acepta fechas futuras', () => como(usuario.supervisor, async (c) => {
      const { filas: [r] } = await nuevo(c, {});
      expect((await intentar(c, 'update registros_horas set fecha = hoy_merida() + 1 where id = $1', [r.id])).error?.message).toMatch(/fechas futuras/);
      expect((await intentar(c, 'update registros_horas set empleado_id = $2 where id = $1', [r.id, empleado.eventual])).error?.message).toMatch(/permission denied/);
    }));

    it('la capturista no puede editar', () => como(usuario.capturista, async (c) => {
      const { rows: [r] } = await c.query('select id from v_registros where anio_iso = 2026 and semana = 41 limit 1');
      expect((await intentar(c, 'update registros_horas set horas = 1 where id = $1', [r.id])).n).toBe(0);
    }));

    it('un registro de sólo alimentos para quien sí genera horas extra', () => como(usuario.capturista, async (c) => {
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, almuerzo: true });
      expect([r.tipo_clave, Number(r.horas), Number(r.total)]).toEqual([null, 0, 50]);
    }));
  });

  describe('tarifas y totales', () => {
    it('cambiar una tarifa no recalcula registros guardados', () => como(usuario.supervisor, async (c) => {
      const total = async () => Number((await c.query('select sum(total) t from v_registros where anio_iso = 2026 and semana = 41')).rows[0].t);
      const antes = await total();
      await c.query("update tipos_hora set tarifa = 65 where clave = 'NORMAL_LOCAL'");
      expect(await total()).toBe(antes);
      const { filas: [r] } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1 });
      expect(Number(r.tarifa_aplicada)).toBe(65);
    }));

    it('los totales en SQL coinciden con la demo', () => como(usuario.capturista, async (c) => {
      const { rows: [s] } = await c.query(`select
        (select sum(total) from v_registros where anio_iso = 2026 and semana = 41)::float semana41,
        (select count(*) from v_registros where fecha between '2026-09-14' and '2026-10-11')::int registros,
        (select sum(total) from v_registros where fecha between '2026-09-14' and '2026-10-11')::float periodo`);
      expect(s).toEqual({ semana41: 6595, registros: 149, periodo: 34545 });
    }));
  });

  describe('sesión', () => {
    it('sin sesión o con usuario inactivo no se ve ni se captura nada', async () => {
      for (const id of [null, usuario.inactivo]) {
        await como(id, async (c) => {
          const { rows: [r] } = await c.query('select count(*)::int n from empleados');
          expect(r.n).toBe(0);
          const { error } = await insertar(c, { empleado_id: empleado.fijo, fecha: FECHAS.LUNES, tipo_clave: 'NORMAL_LOCAL', horas: 1 });
          expect(error).toBeDefined();
        });
      }
    });

    it('el login encuentra al usuario por correo sin importar mayúsculas ni espacios', () => como(null, async (c) => {
      const { rows } = await c.query('select id, rol, activo, hash from credenciales_para_login($1)', ['  SUPERVISOR@prueba.horex ']);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: usuario.supervisor, rol: 'SUPERVISOR', activo: true });
      expect(rows[0].hash).toMatch(/^scrypt\$/);
    }));
  });

  it('el nombre de empleado es único sin importar mayúsculas, acentos ni espacios', () => como(usuario.supervisor, async (c) => {
    const { error } = await intentar(c, "insert into empleados (nombre, puesto, grupo, reclutador) values ('BRYAN  SILVÉIRA', 'Operador cargador', 'Eventual', 'EVENTUAL')");
    expect(error?.message).toMatch(/empleados_nombre_unico/);
  }));
});
