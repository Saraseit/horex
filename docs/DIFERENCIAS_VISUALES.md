# Diferencias visuales con la demo

La app se compara contra la demo (`docs/referencia/horex-demo.html`) con `npm run test:e2e`
(`tests/e2e/visual.spec.js`): las 7 vistas a 1366 y 400 px, en claro y oscuro, más las vistas de
supervisor de Semana, Empleados y Tarifas (34 capturas, tolerancia 1 % de píxeles).

## Cómo se compara

- Las referencias de la prueba salen de la demo con `node scripts/capturar-referencia.cjs --pruebas`
  (`tests/e2e/referencia/`). Las de `docs/referencia/capturas/` son las mismas sin ocultar nada, para verlas a ojo.
- El viewport se agranda hasta que cabe todo el contenido (la demo hace scroll dentro de `.content`).
- "Hoy" es el 10 oct 2026 (`src/configuracion.js`) y los datos son los de la demo, generados igual
  (`src/datos/datosPrueba.js`): 149 registros, $34,545 en el periodo y $6,595 en la semana 41.
- `VISUAL_ESTRICTO=1 npm run test:e2e` exige 0 píxeles distintos y muestra cuánto difiere cada vista.

## Diferencias intencionales

| Dónde | Demo | App | Por qué | En la prueba |
|---|---|---|---|---|
| Pie de la barra lateral | Selector Capturista/Supervisor y "Cambia el rol para ver permisos" | Usuario de la sesión y botón "Cerrar sesión" con el estilo de `.role-seg` | Prompt §3.2: el rol viene de la sesión | Se oculta el pie en ambas capturas |
| Exportar | Un botón "Copiar tabla para Excel" y el aviso "En esta demo…" | "Descargar .xlsx", "Descargar .csv" y "Copiar tabla para Excel"; sin el aviso | Prompt §6.6 | Captura aprobada de la app (`app-exportar-*`) |
| Por empleado | Sólo el selector de empleado | Además, "Últimas 4 semanas / 8 semanas / Este año". En "Este año" la gráfica es por mes | Prompt §6.4 | A 1366 px cabe en la tolerancia; a 400 px el selector baja de renglón: captura aprobada (`app-empleado-400-*`) |
| Semana actual (supervisor) | Sólo "Eliminar" por fila, en la última columna | Además, una casilla al inicio de cada fila, "Seleccionar todos" y "Eliminar seleccionados (n)" en el encabezado de la tarjeta | Pedido del usuario: borrado masivo, y que en el celular no haya que desplazarse para borrar | Captura aprobada (`app-semana-*-supervisor`) |
| Por período | Fechas libres "desde/hasta"; los botones de mes cortan semanas | Selectores de semana "Semana 38 a Semana 41"; el rango va del lunes de la primera al domingo de la última | Pedido del usuario: las semanas son de lunes a domingo y nunca se cortan | Captura aprobada (`app-periodo-*`) |
| Inicio de sesión | No existe | Tarjeta centrada con el logo, correo, contraseña y "Entrar" (prompt §6.1), en claro y oscuro | La demo no tiene login | Captura aprobada (`app-login-*`) |
| Semana actual, Por empleado, Por período | Una columna "Alim." (D/A/C) y un total de alimentos | Desayuno, almuerzo y cena por separado con monto y cantidad; casillas y "Recibo" en cada fila; tablas con menos espacio entre columnas para que quepan | Pedido del usuario (13 oct 2026) | Capturas aprobadas (`app-semana-*`, `app-empleado-*`, `app-periodo-*`) |
| Tarifas y reglas | Montos de alimentos fijos | Montos de desayuno, almuerzo, cena y domingo del eventual editables | Pedido del usuario | Capturas aprobadas (`app-tarifas-*`) |
| Tarifas (capturista) | "…Cambia a **Supervisor** en la barra lateral para probarlo." | "Solo el supervisor puede modificar tarifas y reglas." | Ya no existe el selector de rol | A 1366 px cabe en la tolerancia; a 400 px el aviso ocupa menos renglones: captura aprobada (`app-tarifas-400-*`) |

Las capturas aprobadas (`tests/e2e/referencia/app-*.png`) se revisaron a ojo. Si esas vistas cambian a
propósito, se revisan otra vez y se regeneran con
`npx playwright test tests/e2e/visual.spec.js --update-snapshots=all -g "<vista> <ancho>px"`.

## Cambios de comportamiento que no salen en las capturas

- **Semanas completas siempre:** ningún reporte corta una semana. Por período y Exportar se eligen por
  semana; "Semana actual" y "Últimas 4 semanas" terminan en domingo; los botones de mes toman las semanas
  que tienen su jueves en ese mes (septiembre 2026 = semanas 36–39, del 31 ago al 27 sep), el mismo
  criterio con el que ISO asigna semanas a un año. En Por empleado, "Este año" va de la semana 1 a la actual.
  Si un rango pasa de 13 semanas, la gráfica se agrupa por mes con ese mismo criterio.
- **Borrado masivo:** casillas en "Registros de la semana" (Semana actual) y en "Historial de registros"
  (Por empleado), sólo para el supervisor. El borrado es todo o nada y pide confirmación ("¿Eliminar 3
  registros? Sí / No"). Los registros de semanas cerradas no se pueden marcar (casilla deshabilitada con la
  explicación). Sigue existiendo "Eliminar" por fila.
- **Semana actual:** "Cerrar semana" pide confirmación en línea ("¿Cerrar semana? Sí / No") y de verdad
  cierra la semana; "Eliminar" sólo aparece en semanas abiertas (la demo lo dejaba en cualquier semana).
- **Selectores de semana** (Semana actual, Por período, Exportar): todas las semanas, sin huecos, desde la
  más antigua con datos hasta la actual; si una semana es de otro año, la etiqueta lleva el año
  ("Semana 52 · 2025").
- **Registrar HE:** si el guardado se rechaza (semana cerrada, fecha futura, empleado inactivo) el
  mensaje aparece en un aviso rojo sobre "Guardar registro". Las tarifas del aviso de domingo y de los
  botones salen de las tarifas vigentes.
- **Empleados:** el formulario de alta agrega "Genera HE" (prompt §6.7).
- **Tarifas y reglas:** la matriz y los montos de alimentos leen los valores vigentes (hoy iguales a la demo).
  Los puestos "Solo alimentos" salen del catálogo de empleados.
- **Filtros en la URL:** semana (`/semana/2026/41`), empleado y rango (`/reportes/empleado/5?rango=8`),
  periodo (`?desde=&hasta=`) y exportación (`?desde=2026-38&hasta=2026-41&formato=detalle`).

## Ajustes para igualar la demo

La demo no declara `<!doctype>` y el navegador la pinta en **modo quirks**. La app está en modo estándar,
así que `src/estilos/base.css` replica los dos efectos visibles: las tablas usan `line-height: normal`, y
`.switch` y `.meals` se alinean arriba (en quirks una línea sin texto propio no reserva alto de texto).
Sin esto cada fila de tabla medía de 1 a 4 px más.

Las fuentes vienen de `@fontsource` (en la demo, de Google Fonts). La diferencia es de uno o dos píxeles de
suavizado en algunas letras, dentro de la tolerancia.
