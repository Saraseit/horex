-- Horex · semilla de producción: tipos de hora, parámetros y la plantilla activa.
-- Plantilla: empleadosactivos horex.pdf (13 oct 2026), sin duplicados y con nombres y puestos homogéneos.
-- Se puede correr varias veces (no duplica). Los cambios posteriores se hacen desde la app.

insert into tipos_hora (clave, etiqueta, tarifa, descripcion, orden) values
  ('NORMAL_LOCAL', 'Normal local', 60, 'Entre semana, hasta la hora 10', 1),
  ('NORMAL_FORANEA', 'Normal foránea', 60, 'Entre semana, servicio fuera de Mérida', 2),
  ('ESPECIAL_LOCAL', 'Especial local', 80, 'Hora 11 en adelante o domingo', 3),
  ('ESPECIAL_FORANEA', 'Especial foránea', 80, 'Hora 11+ o domingo, fuera de Mérida', 4),
  ('MUERTA', 'Muerta', 30, 'Mitad de la tarifa normal', 5),
  ('MUERTA_ESPECIAL', 'Muerta especial', 40, 'Mitad de la tarifa especial', 6)
on conflict (clave) do nothing;

-- Comidas según la captura de la semana 41: desayuno $60, cena $70. Almuerzo sin dato: queda en $50.
insert into parametros (clave, valor, descripcion) values
  ('monto_desayuno', 60, 'Monto del desayuno (entrada a las 6:00 AM o antes)'),
  ('monto_almuerzo', 50, 'Monto del almuerzo (criterio por confirmar)'),
  ('monto_cena', 70, 'Monto de la cena (salida a las 10:00 PM o después)'),
  ('tarifa_domingo_eventual', 70, 'Tarifa por hora del personal eventual en domingo (tipo Especial)')
on conflict (clave) do nothing;

insert into empleados (nombre, puesto, grupo, reclutador, imss, genera_he) values
  ('Joan Argaez Tun', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Miguel Armando Cortes Pinto', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Cindy Cristina Novelo Villalobos', 'Auxiliar de almacén', 'P. Fijo', 'FIJO', true, true),
  ('Jeanine Beatriz Perez Falcon', 'Encargada de almacén de blancos', 'P. Fijo', 'FIJO', true, true),
  ('Gerardo Jose Itza Poot', 'Coordinador de Operaciones', 'P. Fijo', 'FIJO', true, false),
  ('Yahir Antonio de Jesus Nah Molina', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Erik Alejandro Tzec Chacon', 'Especialista de mesas', 'P. Fijo', 'FIJO', true, true),
  ('Angel Enrique Moo Chale', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Antonio Jimenez Morales', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Isaac Ariel Cante Baak', 'Auxiliar de compras', 'P. Fijo', 'FIJO', true, true),
  ('Armando Andres Guzman Coba', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Mirian Noemi Dzul Uc', 'Encargada de nómina', 'P. Fijo', 'FIJO', true, true),
  ('Marilu Hernandez Rodriguez', 'Auxiliar de limpieza', 'P. Fijo', 'FIJO', true, true),
  ('Jorge Andres Garcia de Leon', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Erik Alexander Nah Chan', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Luis Mauricio Garrido Marmolejo', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Eric de Jesus Echeverria Cime', 'Almacenista', 'P. Fijo', 'FIJO', true, false),
  ('Manuel Alejandro Galue Cetina', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Delmer Adolfo Gamboa Arjona', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Lucas Ivan Salvador Rosario', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Carlos Francisco May Cervantes', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Aldry Rangel Ake Pech', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Angel Gabriel Heredia Tun', 'Operador cargador', 'P. Fijo', 'FIJO', false, true),
  ('Javier Alejandro Miss Dzul', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Jesus Ricardo Balam Chacon', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Juan Gabriel Chan Itza', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Marvin Armando Cortes Cime', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Miguel Antonio Garcia Chin', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Miguel de J. Caballero Chimas', 'Operador cargador', 'P. Fijo', 'FIJO', false, true),
  ('Santos Manuel Uitz Chan', 'Operador cargador', 'P. Fijo', 'FIJO', false, true),
  ('Juan Luna Chantero', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Bryan Silveira', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Victor Manuel Garcia', 'Operador cargador', 'P. Fijo', 'FIJO', false, true),
  ('Juan Carlos Benito', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Alvaro Jara Song', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Wilberth Chan Balam', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Adolfo Sulub Garcia', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Saul Nah Itza', 'Operador cargador', 'P. Fijo', 'FIJO', true, true)
on conflict (normalizar_nombre(nombre)) do nothing;
