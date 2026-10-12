-- Horex · 0003: permisos. La API se conecta como horex_api (sin ser dueña de nada): lo que no está
-- concedido aquí, no lo puede hacer aunque tenga un error. Nadie borra filas (no hay DELETE para nadie).

alter table usuarios enable row level security;
alter table credenciales enable row level security;
alter table empleados enable row level security;
alter table tipos_hora enable row level security;
alter table parametros enable row level security;
alter table registros_horas enable row level security;
alter table semanas_cerradas enable row level security;
alter table entorno enable row level security;

grant usage on schema public to horex_api;

-- Lectura: cualquier usuario activo. De `usuarios` sólo id, nombre, rol y activo (sin correo).
grant select (id, nombre, rol, activo) on usuarios to horex_api;
grant select on empleados, tipos_hora, parametros, registros_horas, semanas_cerradas, v_registros to horex_api;

create policy usuarios_leer on usuarios for select to horex_api using (usuario_activo());
create policy empleados_leer on empleados for select to horex_api using (usuario_activo());
create policy tipos_leer on tipos_hora for select to horex_api using (usuario_activo());
create policy parametros_leer on parametros for select to horex_api using (usuario_activo());
create policy registros_leer on registros_horas for select to horex_api using (usuario_activo());
create policy semanas_leer on semanas_cerradas for select to horex_api using (usuario_activo());

-- Captura: cualquier usuario activo, siempre a su nombre. Sólo las columnas que decide quien captura;
-- tarifa_aplicada sólo cuenta si el supervisor marca tarifa_manual (el trigger ignora el resto).
grant insert (empleado_id, fecha, tipo_clave, horas, tarifa_aplicada, tarifa_manual, nota, desayuno, almuerzo, cena)
  on registros_horas to horex_api;
create policy registros_capturar on registros_horas for insert to horex_api
  with check (usuario_activo() and capturado_por = usuario_actual());

-- Borrado lógico: sólo supervisor y sólo en semanas abiertas (el trigger lo vuelve a revisar con mensaje claro).
grant update (eliminado_at, eliminado_por) on registros_horas to horex_api;
create policy registros_eliminar on registros_horas for update to horex_api
  using (es_supervisor() and not semana_cerrada(anio_iso, semana))
  with check (es_supervisor());

-- Catálogos y tarifas: sólo supervisor.
grant insert (nombre, puesto, grupo, reclutador, imss, genera_he) on empleados to horex_api;
grant update (nombre, puesto, grupo, reclutador, imss, genera_he, activo) on empleados to horex_api;
create policy empleados_alta on empleados for insert to horex_api with check (es_supervisor());
create policy empleados_cambio on empleados for update to horex_api using (es_supervisor()) with check (es_supervisor());

grant update (tarifa) on tipos_hora to horex_api;
create policy tipos_cambio on tipos_hora for update to horex_api using (es_supervisor()) with check (es_supervisor());

grant update (valor) on parametros to horex_api;
create policy parametros_cambio on parametros for update to horex_api using (es_supervisor()) with check (es_supervisor());

-- Cierre de semana: sólo supervisor.
grant insert (anio_iso, semana) on semanas_cerradas to horex_api;
create policy semanas_cerrar on semanas_cerradas for insert to horex_api with check (es_supervisor());

-- Funciones: el login sólo lo usa la API; nada es ejecutable por PUBLIC.
revoke execute on all functions in schema public from public;
grant execute on function usuario_actual(), usuario_activo(), es_supervisor(), semana_cerrada(int, int),
  calcular_tarifa(bigint, date, text), hoy_merida(), normalizar_nombre(text), credenciales_para_login(text)
  to horex_api;
-- normalizar_nombre (índice único de empleados) usa unaccent, que también quedó sin permiso para PUBLIC.
grant execute on function unaccent(regdictionary, text) to horex_api;
-- Identidades de registros_horas y empleados.
grant usage on all sequences in schema public to horex_api;
-- Los triggers corren con los permisos de quien inserta: necesitan ejecutar sus funciones auxiliares.
grant execute on function registros_antes_de_insertar(), registros_antes_de_actualizar(), semanas_antes_de_cerrar()
  to horex_api;
