-- Horex · 0005 (pedido del usuario, 13 oct 2026): el supervisor puede editar un registro (fecha, tipo, horas,
-- comidas, tarifa manual). No se cambia el empleado ni quién capturó: para eso se elimina y se recaptura.
-- · La tarifa se recalcula sólo si cambia el tipo o la fecha (o si deja de ser manual); si no, conserva la
--   tarifa con que se capturó.
-- · Las comidas conservan los montos guardados al capturar el registro.
-- · Sin tipo de hora, el registro queda como "Solo alimentos" (0 horas).
-- · Queda quién editó y cuándo.

alter table registros_horas
  add column editado_at timestamptz,
  add column editado_por uuid references usuarios(id);

-- La vista usa r.*: se vuelve a crear para que incluya las columnas nuevas.
drop view v_registros;
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

grant update (fecha, tipo_clave, horas, tarifa_aplicada, tarifa_manual, nota, desayuno, almuerzo, cena)
  on registros_horas to horex_api;

create or replace function registros_antes_de_actualizar() returns trigger
language plpgsql
as $$
declare
  e empleados;
begin
  if old.eliminado_at is not null then
    raise exception 'El registro ya estaba eliminado.';
  end if;
  if (new.empleado_id, new.monto_desayuno, new.monto_almuerzo, new.monto_cena, new.capturado_por, new.created_at)
     is distinct from
     (old.empleado_id, old.monto_desayuno, old.monto_almuerzo, old.monto_cena, old.capturado_por, old.created_at) then
    raise exception 'No se puede cambiar el empleado: elimina el registro y vuelve a capturarlo.';
  end if;
  if not es_supervisor() then
    raise exception 'Solo el supervisor puede editar o eliminar registros.';
  end if;

  -- Borrado lógico: sólo eso, sin otros cambios.
  if new.eliminado_at is not null then
    if (new.fecha, new.tipo_clave, new.horas, new.tarifa_aplicada, new.tarifa_manual, new.nota,
        new.desayuno, new.almuerzo, new.cena)
       is distinct from
       (old.fecha, old.tipo_clave, old.horas, old.tarifa_aplicada, old.tarifa_manual, old.nota,
        old.desayuno, old.almuerzo, old.cena) then
      raise exception 'Al eliminar no se puede cambiar nada más del registro.';
    end if;
    new.eliminado_at := now();
    new.eliminado_por := usuario_actual();
    return new;
  end if;

  -- Edición.
  if new.fecha > hoy_merida() then
    raise exception 'No se pueden capturar fechas futuras.';
  end if;
  select * into e from empleados where id = new.empleado_id;

  if not e.genera_he or new.tipo_clave is null then
    -- Puesto sin horas extra, o registro de sólo alimentos.
    new.tipo_clave := null;
    new.horas := 0;
    new.tarifa_aplicada := 0;
    new.tarifa_manual := false;
    new.nota := null;
  elsif new.tarifa_manual then
    if coalesce(btrim(new.nota), '') = '' then
      raise exception 'La tarifa manual necesita una nota que explique el motivo.';
    end if;
  else
    new.nota := null;
    if old.tarifa_manual or old.tipo_clave is null
       or (new.tipo_clave, new.fecha) is distinct from (old.tipo_clave, old.fecha) then
      new.tarifa_aplicada := calcular_tarifa(new.empleado_id, new.fecha, new.tipo_clave);
    else
      new.tarifa_aplicada := old.tarifa_aplicada; -- conserva la tarifa con que se capturó
    end if;
  end if;

  new.editado_at := now();
  new.editado_por := usuario_actual();
  return new;
end $$;
