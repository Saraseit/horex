-- Horex · 0002: reglas de negocio en la base (fuente de verdad).
-- calcular_tarifa debe pasar los mismos casos que src/logica/reglas.js (src/logica/casosTarifa.js).

-- ¿El usuario de la petición existe y está activo? (security definer: lee usuarios sin pasar por RLS)
create function usuario_activo() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios where id = usuario_actual() and activo) $$;

create function es_supervisor() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from usuarios where id = usuario_actual() and activo and rol = 'SUPERVISOR') $$;

create function semana_cerrada(p_anio int, p_semana int) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from semanas_cerradas where anio_iso = p_anio and semana = p_semana) $$;

/*
  Tarifa por hora según empleado, fecha y tipo:
  | Situación                         | P. Fijo | Eventual                                   |
  | Normal (local o foránea)          | tipo    | tipo                                       |
  | Especial entre semana (hora 11+)  | tipo    | tipo — POR CONFIRMAR                       |
  | Domingo, Especial                 | tipo    | parametros.tarifa_domingo_eventual         |
  | Muerta                            | tipo    | tipo                                       |
  | Muerta especial                   | tipo    | tipo — POR CONFIRMAR                       |
  Puestos sin horas extra y registros "Solo alimentos": 0.
*/
create function calcular_tarifa(p_empleado_id bigint, p_fecha date, p_tipo_clave text) returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  e empleados;
  t tipos_hora;
begin
  if p_tipo_clave is null then
    return 0;
  end if;
  select * into e from empleados where id = p_empleado_id;
  if not found then
    raise exception 'El empleado % no existe.', p_empleado_id;
  end if;
  if not e.genera_he then
    return 0;
  end if;
  select * into t from tipos_hora where clave = p_tipo_clave;
  if not found then
    raise exception 'Tipo de hora desconocido: %', p_tipo_clave;
  end if;
  if e.grupo = 'Eventual' and p_tipo_clave like 'ESPECIAL%' and extract(isodow from p_fecha) = 7 then
    return (select valor from parametros where clave = 'tarifa_domingo_eventual');
  end if;
  return t.tarifa;
end $$;

-- Antes de insertar: la base decide tarifa, alimentos y quién capturó; rechaza lo que no se permite.
create function registros_antes_de_insertar() returns trigger
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
    -- Coordinador de Operaciones y Almacenista: sólo alimentos.
    new.tipo_clave := null;
    new.horas := 0;
    new.tarifa_aplicada := 0;
    new.tarifa_manual := false;
  elsif new.tarifa_manual then
    -- Excepción puesta a mano por el supervisor, con nota obligatoria.
    if not es_supervisor() then
      raise exception 'Solo el supervisor puede poner una tarifa manual.';
    end if;
    if coalesce(btrim(new.nota), '') = '' then
      raise exception 'La tarifa manual necesita una nota que explique el motivo.';
    end if;
  else
    -- La tarifa que mande el cliente se ignora.
    new.tarifa_aplicada := calcular_tarifa(new.empleado_id, new.fecha, new.tipo_clave);
  end if;

  new.monto_alimento := (select valor from parametros where clave = 'monto_alimento');
  new.capturado_por := usuario_actual();
  new.created_at := now();
  new.eliminado_at := null;
  new.eliminado_por := null;
  return new;
end $$;

create trigger registros_antes_de_insertar
before insert on registros_horas
for each row execute function registros_antes_de_insertar();

-- Antes de actualizar: lo único permitido es el borrado lógico, una vez y en semana abierta.
create function registros_antes_de_actualizar() returns trigger
language plpgsql
as $$
begin
  if (new.empleado_id, new.fecha, new.tipo_clave, new.horas, new.tarifa_aplicada, new.tarifa_manual, new.nota,
      new.desayuno, new.almuerzo, new.cena, new.monto_alimento, new.capturado_por, new.created_at)
     is distinct from
     (old.empleado_id, old.fecha, old.tipo_clave, old.horas, old.tarifa_aplicada, old.tarifa_manual, old.nota,
      old.desayuno, old.almuerzo, old.cena, old.monto_alimento, old.capturado_por, old.created_at) then
    raise exception 'Los registros no se editan: elimínalo y vuelve a capturarlo.';
  end if;
  if old.eliminado_at is not null then
    raise exception 'El registro ya estaba eliminado.';
  end if;
  if new.eliminado_at is null then
    raise exception 'Lo único que se puede hacer con un registro es eliminarlo.';
  end if;
  if semana_cerrada(old.anio_iso, old.semana) then
    raise exception 'La semana % está cerrada: no se pueden eliminar sus registros.', old.semana;
  end if;
  new.eliminado_at := now();
  new.eliminado_por := usuario_actual();
  return new;
end $$;

create trigger registros_antes_de_actualizar
before update on registros_horas
for each row execute function registros_antes_de_actualizar();

-- Al cerrar una semana: quién y cuándo los pone la base.
create function semanas_antes_de_cerrar() returns trigger
language plpgsql
as $$
begin
  if (new.anio_iso, new.semana) > (extract(isoyear from hoy_merida())::int, extract(week from hoy_merida())::int) then
    raise exception 'No se puede cerrar una semana que todavía no empieza.';
  end if;
  new.cerrada_por := usuario_actual();
  new.cerrada_at := now();
  return new;
end $$;

create trigger semanas_antes_de_cerrar
before insert on semanas_cerradas
for each row execute function semanas_antes_de_cerrar();

-- Login: la API busca credenciales por correo antes de que haya sesión. Sólo la API puede llamarla.
create function credenciales_para_login(p_correo text)
returns table (id uuid, nombre text, rol text, activo boolean, hash text)
language sql stable security definer set search_path = public
as $$
  select u.id, u.nombre, u.rol, u.activo, c.hash
  from usuarios u join credenciales c on c.usuario_id = u.id
  where lower(u.correo) = lower(btrim(p_correo))
$$;
