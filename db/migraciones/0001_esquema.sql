-- Horex · 0001: tablas, índices y vista de reportes.
-- Diferencias con el prompt (Supabase → Neon): no existe auth.users, así que `usuarios` tiene su propio id
-- y correo, y las contraseñas viven aparte en `credenciales`. El usuario de cada petición lo fija la API con
-- set_config('horex.usuario_id', …, true) y se lee con usuario_actual() (0002).

create extension if not exists unaccent;

-- Rol con el que se conecta la API. No es dueño de las tablas, así que RLS sí le aplica.
-- La contraseña (y LOGIN) se la pone scripts/crear-rol-api.js, nunca una migración.
do $$
begin
  if not exists (select from pg_roles where rolname = 'horex_api') then
    create role horex_api nologin;
  end if;
end $$;

-- Usuario de la petición en curso (null si no hay).
create function usuario_actual() returns uuid
language sql stable
as $$ select nullif(current_setting('horex.usuario_id', true), '')::uuid $$;

-- Minúsculas, sin acentos y sin espacios de más: para comparar nombres.
create function normalizar_nombre(texto text) returns text
language sql immutable parallel safe
as $$ select lower(regexp_replace(btrim(public.unaccent('public.unaccent'::regdictionary, texto)), '\s+', ' ', 'g')) $$;

-- Fecha de hoy en Mérida, sin importar la zona del servidor.
create function hoy_merida() returns date
language sql stable
as $$ select (now() at time zone 'America/Merida')::date $$;

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  correo text not null,
  nombre text not null,
  rol text not null check (rol in ('CAPTURISTA', 'SUPERVISOR')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index usuarios_correo_unico on usuarios (lower(correo));

-- Separada de `usuarios` para que la API nunca pueda leer hashes con un select normal.
create table credenciales (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  hash text not null,
  actualizada_at timestamptz not null default now()
);

create table empleados (
  id bigint generated always as identity primary key,
  nombre text not null,
  puesto text not null,
  grupo text not null check (grupo in ('P. Fijo', 'Eventual')),
  reclutador text not null check (reclutador in ('FIJO', 'EVENTUAL')),
  imss boolean not null default true,
  genera_he boolean not null default true,   -- false para Coordinador de Operaciones y Almacenista
  activo boolean not null default true,      -- los empleados nunca se borran
  created_at timestamptz not null default now()
);
-- Nombre único ignorando mayúsculas, acentos y espacios.
create unique index empleados_nombre_unico on empleados (normalizar_nombre(nombre));

create table tipos_hora (
  clave text primary key,          -- NORMAL_LOCAL, NORMAL_FORANEA, ESPECIAL_LOCAL, ESPECIAL_FORANEA, MUERTA, MUERTA_ESPECIAL
  etiqueta text not null,
  tarifa numeric(8,2) not null check (tarifa >= 0),
  descripcion text not null,
  orden int not null
);

create table parametros (
  clave text primary key,          -- monto_alimento, tarifa_domingo_eventual
  valor numeric(8,2) not null check (valor >= 0),
  descripcion text not null default ''
);

create table registros_horas (
  id bigint generated always as identity primary key,
  empleado_id bigint not null references empleados(id),
  fecha date not null,
  anio_iso int generated always as (extract(isoyear from fecha)::int) stored,
  semana int generated always as (extract(week from fecha)::int) stored,
  tipo_clave text references tipos_hora(clave),       -- null = "Solo alimentos"
  horas numeric(4,1) not null default 0 check (horas >= 0 and horas <= 16),
  tarifa_aplicada numeric(8,2) not null default 0 check (tarifa_aplicada >= 0), -- inmutable: se fija al insertar
  tarifa_manual boolean not null default false,        -- true: la puso el supervisor, no la regla
  nota text,                                           -- obligatoria con tarifa manual
  desayuno boolean not null default false,
  almuerzo boolean not null default false,
  cena boolean not null default false,
  monto_alimento numeric(8,2) not null default 0,      -- copia del parámetro vigente al insertar
  importe_he numeric(10,2) generated always as (horas * tarifa_aplicada) stored,
  importe_alimentos numeric(10,2) generated always as (
    ((desayuno::int) + (almuerzo::int) + (cena::int)) * monto_alimento) stored,
  total numeric(10,2) generated always as (
    horas * tarifa_aplicada + ((desayuno::int) + (almuerzo::int) + (cena::int)) * monto_alimento) stored,
  capturado_por uuid not null references usuarios(id) default usuario_actual(),
  created_at timestamptz not null default now(),
  eliminado_at timestamptz,                            -- borrado lógico
  eliminado_por uuid references usuarios(id),
  check (tipo_clave is not null or horas = 0),
  check (tipo_clave is null or horas > 0),
  check (tipo_clave is not null or desayuno or almuerzo or cena),
  check (not tarifa_manual or (tipo_clave is not null and coalesce(btrim(nota), '') <> ''))
);
create index registros_semana on registros_horas (anio_iso, semana) where eliminado_at is null;
create index registros_empleado_fecha on registros_horas (empleado_id, fecha) where eliminado_at is null;

create table semanas_cerradas (
  anio_iso int not null,
  semana int not null check (semana between 1 and 53),
  cerrada_por uuid not null references usuarios(id) default usuario_actual(),
  cerrada_at timestamptz not null default now(),
  primary key (anio_iso, semana)
);

-- Una sola fila: 'produccion' o 'desarrollo'. Los scripts de datos de prueba se niegan a correr en producción.
create table entorno (
  unico boolean primary key default true check (unico),
  nombre text not null check (nombre in ('produccion', 'desarrollo'))
);

-- Vista para reportes y exportación (security_invoker: respeta RLS de quien consulta).
create view v_registros with (security_invoker = true) as
select r.*, e.nombre, e.puesto, e.grupo, e.reclutador, e.imss,
       coalesce(t.etiqueta, 'Solo alimentos') as tipo_etiqueta,
       u.nombre as capturado_por_nombre
from registros_horas r
join empleados e on e.id = r.empleado_id
left join tipos_hora t on t.clave = r.tipo_clave
join usuarios u on u.id = r.capturado_por
where r.eliminado_at is null;
