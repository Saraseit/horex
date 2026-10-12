-- Horex · semilla de producción: tipos de hora, parámetros y los 25 empleados activos de la demo.
-- Se puede correr varias veces (no duplica). Los cambios posteriores se hacen desde la app.

insert into tipos_hora (clave, etiqueta, tarifa, descripcion, orden) values
  ('NORMAL_LOCAL', 'Normal local', 60, 'Entre semana, hasta la hora 10', 1),
  ('NORMAL_FORANEA', 'Normal foránea', 60, 'Entre semana, servicio fuera de Mérida', 2),
  ('ESPECIAL_LOCAL', 'Especial local', 80, 'Hora 11 en adelante o domingo', 3),
  ('ESPECIAL_FORANEA', 'Especial foránea', 80, 'Hora 11+ o domingo, fuera de Mérida', 4),
  ('MUERTA', 'Muerta', 30, 'Mitad de la tarifa normal', 5),
  ('MUERTA_ESPECIAL', 'Muerta especial', 40, 'Mitad de la tarifa especial', 6)
on conflict (clave) do nothing;

insert into parametros (clave, valor, descripcion) values
  ('monto_alimento', 50, 'Monto por desayuno, almuerzo o cena'),
  ('tarifa_domingo_eventual', 70, 'Tarifa por hora del personal eventual en domingo (tipo Especial)')
on conflict (clave) do nothing;

insert into empleados (nombre, puesto, grupo, reclutador, imss, genera_he) values
  ('Miguel Armando Cortes Pinto', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Cindy Cristina Novelo Villalobos', 'Auxiliar de almacén', 'P. Fijo', 'FIJO', true, true),
  ('Jeanine Beatriz Perez Falcon', 'Encargada de almacén blancos', 'P. Fijo', 'FIJO', true, true),
  ('Gerardo Jose Itza Poot', 'Coordinador de Operaciones', 'P. Fijo', 'FIJO', true, false),
  ('Yahir Antonio Nah Molina', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Erik Alejandro Tzec Chacon', 'Especialista de mesas', 'P. Fijo', 'FIJO', true, true),
  ('Angel Enrique Moo Chale', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Antonio Jimenez Morales', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Isac Ariel Cante Baak', 'Auxiliar de compras', 'P. Fijo', 'FIJO', true, true),
  ('Armando Andres Guzman Coba', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Mirian Noemi Dzul Uc', 'Encargada de nómina', 'P. Fijo', 'FIJO', true, true),
  ('Luis Mauricio Garrido Marmolejo', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Eric de Jesus Echeverria Cime', 'Almacenista', 'P. Fijo', 'FIJO', true, false),
  ('Delmer Adolfo Gamboa Arjona', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Lucas Ivan Salvador Rosario', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Carlos Francisco May Cervantes', 'Chofer cargador', 'P. Fijo', 'FIJO', true, true),
  ('Aldry Rangel Ake Pech', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Angel Gabriel Heredia Tun', 'Operador cargador', 'P. Fijo', 'FIJO', false, true),
  ('Javier Alejandro Miss Dzul', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Jesus Ricardo Balam Chacon', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Juan Gabriel Chan Itza', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Jorge Andres Garcia de Leon', 'Operador cargador', 'P. Fijo', 'FIJO', true, true),
  ('Bryan Silveira', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Victor Manuel Garcia', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true),
  ('Juan Carlos Benito', 'Operador cargador', 'Eventual', 'EVENTUAL', false, true)
on conflict (normalizar_nombre(nombre)) do nothing;
