-- Horex · 0007 (pedido del usuario, 21 oct 2026):
-- 1. Rol CONSULTA (RH y Finanzas): ve reportes, exporta y descarga recibos; no captura, no edita, no borra
--    y no cambia catálogos ni tarifas.
-- 2. La cena del personal eventual se paga a $60 (parámetro monto_cena_eventual); el personal fijo sigue con
--    monto_cena. Cada registro guarda el monto vigente al capturarlo, como las demás comidas.

-- ── Rol de solo consulta ──
alter table usuarios drop constraint usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check check (rol in ('CAPTURISTA', 'SUPERVISOR', 'CONSULTA'));

create function puede_capturar() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios where id = usuario_actual() and activo and rol in ('CAPTURISTA', 'SUPERVISOR')) $$;
revoke execute on function puede_capturar() from public;
grant execute on function puede_capturar() to horex_api;

drop policy registros_capturar on registros_horas;
create policy registros_capturar on registros_horas for insert to horex_api
  with check (puede_capturar() and capturado_por = usuario_actual());

-- ── Cena del personal eventual ──
insert into parametros (clave, valor, descripcion)
values ('monto_cena_eventual', 60, 'Monto de la cena del personal eventual (salida a las 10:00 PM o después)')
on conflict (clave) do nothing;

-- ── Trigger de captura: igual que 0004, más el rol y la cena por grupo ──
create or replace function registros_antes_de_insertar() returns trigger
language plpgsql
as $$
declare
  e empleados;
begin
  if usuario_actual() is null or not usuario_activo() then
    raise exception 'Sesión no válida: vuelve a iniciar sesión.';
  end if;
  if not puede_capturar() then
    raise exception 'Tu usuario es de solo consulta: no puede capturar registros.';
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
  new.monto_cena := (select valor from parametros
                     where clave = case when e.grupo = 'Eventual' then 'monto_cena_eventual' else 'monto_cena' end);
  new.capturado_por := usuario_actual();
  new.created_at := now();
  new.eliminado_at := null;
  new.eliminado_por := null;
  return new;
end $$;
