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
| Tarifas (capturista) | "…Cambia a **Supervisor** en la barra lateral para probarlo." | "Solo el supervisor puede modificar tarifas y reglas." | Ya no existe el selector de rol | A 1366 px cabe en la tolerancia; a 400 px el aviso ocupa menos renglones: captura aprobada (`app-tarifas-400-*`) |

Las capturas aprobadas (`tests/e2e/referencia/app-*.png`) se revisaron a ojo. Si esas vistas cambian a
propósito, se revisan otra vez y se regeneran con
`npx playwright test tests/e2e/visual.spec.js --update-snapshots=all -g "<vista> <ancho>px"`.

## Cambios de comportamiento que no salen en las capturas

- **Semana actual:** "Cerrar semana" pide confirmación en línea ("¿Cerrar semana? Sí / No") y de verdad
  cierra la semana; "Eliminar" sólo aparece en semanas abiertas (la demo lo dejaba en cualquier semana).
- **Selector de semanas:** lista las semanas con datos más la actual; si una semana es de otro año, la
  etiqueta lleva el año ("Semana 52 · 2025").
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
