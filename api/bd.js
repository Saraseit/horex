// Conexión a Neon. Cada petición corre en una transacción con su usuario fijado para RLS
// (set_config('horex.usuario_id', …, true) vale sólo dentro de la transacción: compatible con el pooler).
import pg from 'pg';

// Tipos de Postgres → JS: numeric e int8 como número; date como texto 'yyyy-MM-dd' (nunca Date: lo correría de día).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export function crearBd(url) {
  const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
  pool.on('error', (e) => console.error('Postgres:', e.message));

  return {
    /** Corre fn(cliente) en una transacción como `usuarioId` (null = sin sesión). */
    async transaccion(usuarioId, fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        await cliente.query("select set_config('horex.usuario_id', $1, true)", [usuarioId ?? '']);
        const resultado = await fn(cliente);
        await cliente.query('commit');
        return resultado;
      } catch (e) {
        await cliente.query('rollback').catch(() => {});
        throw e;
      } finally {
        cliente.release();
      }
    },
    cerrar: () => pool.end(),
  };
}
