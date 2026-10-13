// Importa la hoja DATABASE del Excel de horas extra (formato del Sheets original).
// Uso: node scripts/importar-excel.js --destino desarrollo|produccion --archivo docs/archivo.xlsx
//        [--simular] [--ajustar-montos] [--reemplazar-semana]
//   --simular           hace todo dentro de una transacción y la deshace al final (no escribe nada).
//   --ajustar-montos    si el Excel paga una comida con otro monto, actualiza ese monto en parámetros.
//   --reemplazar-semana si ya hay registros en esas semanas, los elimina (borrado lógico) antes de importar.
// No adivina: si un nombre no empata (ni con los alias de abajo) escribe docs/importacion/pendientes.csv y
// no importa nada. Respeta la tarifa del Excel: si la regla da otra, el registro entra como tarifa manual con
// nota. Al final compara horas, importes y alimentos contra el Excel: si no cuadra, no se guarda nada.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { argumento, bandera, cargarEntorno, conectar, destino } from './comun.js';

// Variantes de nombre en el Excel → nombre del catálogo (empleadosactivos horex.pdf, 13 oct 2026).
const ALIAS = {
  'jesus ricardo balam': 'Jesus Ricardo Balam Chacon',
  'carlos francisco may cerantes': 'Carlos Francisco May Cervantes',
  'erick alexander nah chan': 'Erik Alexander Nah Chan',
  'antonio de jesus nah molina yahir': 'Yahir Antonio de Jesus Nah Molina',
  'isac ariel cante baak': 'Isaac Ariel Cante Baak',
  'luis mauricio garrido': 'Luis Mauricio Garrido Marmolejo',
  'manuel a.galue cetina': 'Manuel Alejandro Galue Cetina',
  'marilu hernandez hernandez': 'Marilu Hernandez Rodriguez',
  'javier miss dzul': 'Javier Alejandro Miss Dzul',
};
const USUARIO_IMPORTACION = { correo: 'importacion@horex.local', nombre: 'Importación (Excel)' };
const COMIDAS = [['desayuno', 'monto_desayuno'], ['almuerzo', 'monto_almuerzo'], ['cena', 'monto_cena']];

const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const valor = (c) => (c && typeof c === 'object' && 'result' in c ? c.result : c);
const numero = (c) => Number(valor(c) ?? 0);
const casi = (a, b) => Math.abs(a - b) < 0.005;

cargarEntorno();
const base = destino();
const archivo = argumento('archivo');
if (!archivo) {
  console.error('Indica el Excel: --archivo docs/Registro_horas_extra.xlsx');
  process.exit(1);
}

// ── Leer el Excel ──
const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(archivo);
const hoja = libro.getWorksheet('DATABASE');
if (!hoja) throw new Error('El Excel no tiene la hoja DATABASE.');
const filas = [];
hoja.eachRow((row, n) => {
  const v = row.values; // 1 = nombre … 8 = fecha … 15 = $ alimentos
  const fecha = valor(v[8]);
  if (typeof valor(v[1]) !== 'string' || !(fecha instanceof Date)) return;
  filas.push({
    fila: n,
    nombre: String(valor(v[1])).trim(),
    tipo: String(valor(v[6]) ?? '').trim(),
    fecha: fecha.toISOString().slice(0, 10),
    horas: numero(v[9]),
    tarifa: numero(v[10]),
    importe: numero(v[11]),
    desayuno: numero(v[12]),
    almuerzo: numero(v[13]),
    cena: numero(v[14]),
  });
});
const sumaExcel = (k) => filas.reduce((s, f) => s + f[k], 0);
console.log(`Excel: ${filas.length} registros, ${sumaExcel('horas')} h, HE $${sumaExcel('importe')}, desayunos $${sumaExcel('desayuno')}, almuerzos $${sumaExcel('almuerzo')}, cenas $${sumaExcel('cena')}`);

const cliente = await conectar(base.url);
try {
  await cliente.query('begin');

  // ── Empatar empleados y tipos ──
  const { rows: empleados } = await cliente.query('select id, nombre, activo, genera_he from empleados');
  const porNombre = new Map(empleados.map((e) => [normalizar(e.nombre), e]));
  const { rows: tipos } = await cliente.query('select clave, etiqueta from tipos_hora');
  const tipoPorEtiqueta = new Map(tipos.map((t) => [normalizar(t.etiqueta), t.clave]));

  const pendientes = [];
  for (const f of filas) {
    const clave = normalizar(f.nombre);
    f.empleado = porNombre.get(clave) ?? porNombre.get(normalizar(ALIAS[clave] ?? ''));
    f.tipo_clave = f.tipo ? tipoPorEtiqueta.get(normalizar(f.tipo)) : null;
    if (!f.empleado) pendientes.push([f.fila, f.nombre, 'Sin empleado en el catálogo']);
    else if (!f.empleado.activo) pendientes.push([f.fila, f.nombre, 'Empleado inactivo']);
    if (f.tipo && !f.tipo_clave) pendientes.push([f.fila, f.nombre, `Tipo de hora desconocido: ${f.tipo}`]);
    if (!casi(f.horas * f.tarifa, f.importe)) pendientes.push([f.fila, f.nombre, `Importe ${f.importe} ≠ ${f.horas} h × ${f.tarifa}`]);
  }
  if (pendientes.length) {
    const carpeta = fileURLToPath(new URL('../docs/importacion/', import.meta.url));
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(`${carpeta}pendientes.csv`, '﻿fila,nombre,problema\r\n' + pendientes.map((p) => p.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
    throw new Error(`${pendientes.length} filas sin resolver: revisa docs/importacion/pendientes.csv. No se importó nada.`);
  }

  // ── Montos de comidas: deben coincidir con los parámetros ──
  const { rows: params } = await cliente.query('select clave, valor from parametros');
  const parametro = Object.fromEntries(params.map((p) => [p.clave, Number(p.valor)]));
  for (const [comida, clave] of COMIDAS) {
    const montos = [...new Set(filas.map((f) => f[comida]).filter((m) => m > 0))];
    if (!montos.length) continue;
    if (montos.length > 1) throw new Error(`El ${comida} tiene varios montos en el Excel (${montos.join(', ')}): no se puede importar con un solo monto.`);
    if (!casi(montos[0], parametro[clave])) {
      if (!bandera('ajustar-montos')) throw new Error(`El Excel paga el ${comida} a $${montos[0]} y Horex a $${parametro[clave]}. Usa --ajustar-montos o cámbialo en Tarifas y reglas.`);
      await cliente.query('update parametros set valor = $2 where clave = $1', [clave, montos[0]]);
      console.log(`  ${comida}: monto ajustado de $${parametro[clave]} a $${montos[0]}`);
    }
  }

  // ── Usuario técnico que figura como "Capturó" ──
  const { rows: [tecnico] } = await cliente.query(
    `insert into usuarios (correo, nombre, rol, activo) values ($1, $2, 'SUPERVISOR', true)
     on conflict (lower(correo)) do update set nombre = excluded.nombre, rol = 'SUPERVISOR', activo = true returning id`,
    [USUARIO_IMPORTACION.correo, USUARIO_IMPORTACION.nombre],
  );
  await cliente.query("select set_config('horex.usuario_id', $1, true)", [tecnico.id]);

  // ── Semanas que ya tienen registros ──
  const fechas = filas.map((f) => f.fecha).sort();
  const { rows: existentes } = await cliente.query(
    `select r.id from registros_horas r
     where r.eliminado_at is null and (r.anio_iso, r.semana) in (
       select distinct extract(isoyear from d)::int, extract(week from d)::int from unnest($1::date[]) d)`,
    [fechas],
  );
  if (existentes.length) {
    if (!bandera('reemplazar-semana')) throw new Error(`Esas semanas ya tienen ${existentes.length} registros. Usa --reemplazar-semana para eliminarlos antes de importar.`);
    await cliente.query('update registros_horas set eliminado_at = now() where id = any($1::bigint[])', [existentes.map((r) => r.id)]);
    console.log(`  ${existentes.length} registros anteriores de esas semanas eliminados (borrado lógico)`);
  }

  // ── Insertar ──
  const insertados = [];
  let manuales = 0;
  for (const f of filas) {
    const tipoClave = f.empleado.genera_he ? f.tipo_clave : null;
    let manual = false;
    if (tipoClave && f.horas > 0) {
      const { rows: [{ t }] } = await cliente.query('select calcular_tarifa($1, $2, $3)::float t', [f.empleado.id, f.fecha, tipoClave]);
      manual = !casi(t, f.tarifa);
      if (manual) {
        manuales += 1;
        console.log(`  Tarifa manual: fila ${f.fila}, ${f.nombre}, ${f.fecha}, ${f.tipo}: Excel $${f.tarifa}, la regla da $${t}`);
      }
      f.regla = t;
    }
    const { rows: [r] } = await cliente.query(
      `insert into registros_horas (empleado_id, fecha, tipo_clave, horas, tarifa_aplicada, tarifa_manual, nota, desayuno, almuerzo, cena)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, horas, importe_he, importe_desayuno, importe_almuerzo, importe_cena, total`,
      [f.empleado.id, f.fecha, tipoClave, f.empleado.genera_he ? f.horas : 0, manual ? f.tarifa : 0, manual,
        manual ? `Importado del Excel con la tarifa original de $${f.tarifa}/hr (la regla da $${f.regla}).` : null,
        f.desayuno > 0, f.almuerzo > 0, f.cena > 0],
    );
    insertados.push(r);
  }

  // ── Cuadre contra el Excel ──
  const suma = (k) => insertados.reduce((s, r) => s + Number(r[k]), 0);
  const cuadre = [
    ['Registros', filas.length, insertados.length],
    ['Horas', sumaExcel('horas'), suma('horas')],
    ['Importe HE', sumaExcel('importe'), suma('importe_he')],
    ['Desayunos', sumaExcel('desayuno'), suma('importe_desayuno')],
    ['Almuerzos', sumaExcel('almuerzo'), suma('importe_almuerzo')],
    ['Cenas', sumaExcel('cena'), suma('importe_cena')],
    ['Total', sumaExcel('importe') + sumaExcel('desayuno') + sumaExcel('almuerzo') + sumaExcel('cena'), suma('total')],
  ];
  console.log('\nCuadre            Excel        Horex');
  for (const [k, a, b] of cuadre) console.log(`${casi(a, b) ? '✓' : '✗'} ${k.padEnd(12)} ${String(a).padStart(10)} ${String(b).padStart(12)}`);
  if (cuadre.some(([, a, b]) => !casi(a, b))) throw new Error('Los totales no cuadran con el Excel. No se guardó nada.');

  if (bandera('simular')) {
    await cliente.query('rollback');
    console.log(`\nSimulación en "${base.nombre}": todo cuadra (${manuales} con tarifa manual). No se guardó nada.`);
  } else {
    await cliente.query('commit');
    console.log(`\n✓ Importados ${insertados.length} registros en "${base.nombre}" (${manuales} con tarifa manual).`);
  }
} catch (e) {
  await cliente.query('rollback').catch(() => {});
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
