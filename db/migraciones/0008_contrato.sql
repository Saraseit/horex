-- Horex · 0008 (pedido del usuario, 27 oct 2026): número de contrato por registro. Texto libre, casi siempre
-- "0" (sin contrato) y a veces un número como "17106". Se muestra en los reportes y en la exportación.

alter table registros_horas
  add column contrato text not null default '0'
    check (char_length(btrim(contrato)) between 1 and 20);

-- La vista usa r.*: se vuelve a crear para que incluya la columna nueva (misma definición que 0005).
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

-- Quien captura lo escribe; el supervisor lo corrige al editar.
grant insert (contrato), update (contrato) on registros_horas to horex_api;
