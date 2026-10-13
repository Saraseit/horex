-- Horex · 0004 (pedido del usuario, 13 oct 2026):
-- 1. Cada comida tiene su propio monto (desayuno, almuerzo, cena), editable en Tarifas y reglas.
--    Cada registro guarda los montos vigentes al capturarlo; nunca se recalculan.
-- 2. El supervisor puede eliminar cualquier registro, también de semanas cerradas.
--    (Una semana cerrada sigue sin aceptar capturas nuevas.)

-- ── Parámetros: un monto por comida ──
insert into parametros (clave, valor, descripcion)
select 'monto_desayuno', valor, 'Monto del desayuno (entrada a las 6:00 AM o antes)' from parametros where clave = 'monto_alimento'
on conflict (clave) do nothing;
insert into parametros (clave, valor, descripcion)
select 'monto_almuerzo', valor, 'Monto del almuerzo (criterio por confirmar)' from parametros where clave = 'monto_alimento'
on conflict (clave) do nothing;
insert into parametros (clave, valor, descripcion)
select 'monto_cena', valor, 'Monto de la cena (salida a las 10:00 PM o después)' from parametros where clave = 'monto_alimento'
on conflict (clave) do nothing;
delete from parametros where clave = 'monto_alimento';

-- ── Registros: un monto por comida e importes separados ──
drop view v_registros;
alter table registros_horas drop column total, drop column importe_alimentos;
alter table registros_horas
  add column monto_desayuno numeric(8,2) not null default 0,
  add column monto_almuerzo numeric(8,2) not null default 0,
  add column monto_cena numeric(8,2) not null default 0;

-- Los registros que ya existen conservan el monto único que tenían (el trigger de edición no se aplica aquí).
alter table registros_horas disable trigger registros_antes_de_actualizar;
update registros_horas set monto_desayuno = monto_alimento, monto_almuerzo = monto_alimento, monto_cena = monto_alimento;
alter table registros_horas enable trigger registros_antes_de_actualizar;
alter table registros_horas drop column monto_alimento;

alter table registros_horas
  add column importe_desayuno numeric(10,2) generated always as (desayuno::int * monto_desayuno) stored,
  add column importe_almuerzo numeric(10,2) generated always as (almuerzo::int * monto_almuerzo) stored,
  add column importe_cena numeric(10,2) generated always as (cena::int * monto_cena) stored,
  add column importe_alimentos numeric(10,2) generated always as (
    desayuno::int * monto_desayuno + almuerzo::int * monto_almuerzo + cena::int * monto_cena) stored,
  add column total numeric(10,2) generated always as (
    horas * tarifa_aplicada + desayuno::int * monto_desayuno + almuerzo::int * monto_almuerzo + cena::int * monto_cena) stored;

create view v_registros with (security_invoker = true) as
select r.*, e.nombre, e.puesto, e.grupo, e.reclutador, e.imss,
       coalesce(t.etiqueta, 'Solo alimentos') as tipo_etiqueta,
       u.nombre as capturado_por_nombre
from registros_horas r
join empleados e on e.id = r.empleado_id
left join tipos_hora t on t.clave = r.tipo_clave
join usuarios u on u.id = r.capturado_por
where r.eliminado_at is null;
grant select on v_registros to horex_api;

-- ── Trigger de captura: copia el monto vigente de cada comida ──
create or replace function registros_antes_de_insertar() returns trigger
language plpgsql
as $$
declare
  e empleados;
begin
  if usuario_actual() is null or not usuario_activo() then
    raise exception 'Sesión no válida: vuelve a iniciar sesión.';
  end if;
  select * into e from empleados where id = new.empleado_id;
  if not found then
    raise exception 'El empleado no existe.';
  end if;
  if not e.activo then
    raise exception '% está inactivo: no se le pueden capturar registros.', e.nombre;
  end if;
  if new.fecha > hoy_merida() then
    raise exception 'No se pueden capturar fechas futuras.';
  end if;
  if semana_cerrada(extract(isoyear from new.fecha)::int, extract(week from new.fecha)::int) then
    raise exception 'La semana % está cerrada: ya no acepta registros.', extract(week from new.fecha)::int;
  end if;

  if not e.genera_he then
    new.tipo_clave := null;
    new.horas := 0;
    new.tarifa_aplicada := 0;
    new.tarifa_manual := false;
  elsif new.tarifa_manual then
    if not es_supervisor() then
      raise exception 'Solo el supervisor puede poner una tarifa manual.';
    end if;
    if coalesce(btrim(new.nota), '') = '' then
      raise exception 'La tarifa manual necesita una nota que explique el motivo.';
    end if;
  else
    new.tarifa_aplicada := calcular_tarifa(new.empleado_id, new.fecha, new.tipo_clave);
  end if;

  new.monto_desayuno := (select valor from parametros where clave = 'monto_desayuno');
  new.monto_almuerzo := (select valor from parametros where clave = 'monto_almuerzo');
  new.monto_cena := (select valor from parametros where clave = 'monto_cena');
  new.capturado_por := usuario_actual();
  new.created_at := now();
  new.eliminado_at := null;
  new.eliminado_por := null;
  return new;
end $$;

-- ── Trigger de edición: sólo borrado lógico; el supervisor puede borrar en semanas cerradas ──
create or replace function registros_antes_de_actualizar() returns trigger
language plpgsql
as $$
begin
  if (new.empleado_id, new.fecha, new.tipo_clave, new.horas, new.tarifa_aplicada, new.tarifa_manual, new.nota,
      new.desayuno, new.almuerzo, new.cena, new.monto_desayuno, new.monto_almuerzo, new.monto_cena,
      new.capturado_por, new.created_at)
     is distinct from
     (old.empleado_id, old.fecha, old.tipo_clave, old.horas, old.tarifa_aplicada, old.tarifa_manual, old.nota,
      old.desayuno, old.almuerzo, old.cena, old.monto_desayuno, old.monto_almuerzo, old.monto_cena,
      old.capturado_por, old.created_at) then
    raise exception 'Los registros no se editan: elimínalo y vuelve a capturarlo.';
  end if;
  if old.eliminado_at is not null then
    raise exception 'El registro ya estaba eliminado.';
  end if;
  if new.eliminado_at is null then
    raise exception 'Lo único que se puede hacer con un registro es eliminarlo.';
  end if;
  if not es_supervisor() then
    raise exception 'Solo el supervisor puede eliminar registros.';
  end if;
  new.eliminado_at := now();
  new.eliminado_por := usuario_actual();
  return new;
end $$;

drop policy registros_eliminar on registros_horas;
create policy registros_eliminar on registros_horas for update to horex_api
  using (es_supervisor())
  with check (es_supervisor());
