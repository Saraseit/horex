# Horex

Control de horas extra y alimentos del personal operativo. Reemplaza el Google Sheets de nómina.
El plan completo está en [docs/PROMPT_HOREX.md](docs/PROMPT_HOREX.md); la demo de referencia, en
[docs/referencia/horex-demo.html](docs/referencia/horex-demo.html).

**Estado:** Fase 1 (esqueleto visual) terminada: las 7 pantallas funcionan con los datos de prueba de la
demo, en memoria. Todavía no hay base de datos, API ni login (fases 2 y 3).

## Cómo correrlo

Requiere Node 22.12 o más nuevo.

```bash
npm install
npx playwright install chromium   # sólo la primera vez, para las pruebas de navegador
npm run dev                        # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Compila a `dist/` |
| `npm start` | Sirve `dist/` con `servidor.js` (lo que corre en Railway) |
| `npm run lint` | ESLint |
| `npm test` | Pruebas de la lógica (Vitest): reglas de tarifa, fechas, formato, agregados, exportación |
| `npm run test:e2e` | Playwright: 34 comparaciones visuales contra la demo y los flujos principales |
| `npm run capturas:referencia` | Vuelve a tomar las capturas de la demo (`--pruebas` para las de la prueba visual) |

En la Fase 1 la sesión es de prueba: Mirian Dzul como Supervisor. Para ver la app como capturista, en la
consola del navegador: `localStorage.setItem('horex:rol-prueba', 'CAPTURISTA')` y recargar.

## Estructura

```
src/
  main.jsx, App.jsx           rutas
  configuracion.js            "hoy" fijo en 2026-10-10 mientras se usan los datos de la demo
  estilos/                    CSS portado de la demo: tokens, base, layout, componentes
  componentes/                Shell, Sidebar, Topbar, Tarjeta, Tabla, Kpi, BuscadorEmpleado, Toast…
  vistas/                     Registrar, Semana, ReporteEmpleado, ReportePeriodo, Exportar, Empleados, Tarifas
  datos/                      consultas.js (hooks de React Query), datos y almacén de prueba
  logica/                     funciones puras con pruebas: reglas, fechas, formato, agregados, exportar
  sesion/                     sesión (de prueba en la Fase 1)
servidor.js                   sirve dist/ en Railway
tests/e2e/                    Playwright: visual.spec.js, flujos.spec.js y referencias de la demo
scripts/                      capturar-referencia.cjs
docs/                         prompt, demo, capturas, briefing, criterios y diferencias visuales
```

Las diferencias con la demo, y por qué existen, están en
[docs/DIFERENCIAS_VISUALES.md](docs/DIFERENCIAS_VISUALES.md).

## Infraestructura

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Neon, proyecto `horex` (`damp-thunder-68675962`) | Postgres 18, AWS us-east-2, rama `production`, base `neondb` |
| API | Railway, proyecto `horex`, servicio `horex-api` | Node. Sin dominio público: sólo la alcanza `horex-web` por la red privada |
| Web | Railway, proyecto `horex`, servicio `horex-web` | React + Vite. https://horex-web-production.up.railway.app |

Variables en Railway (los valores viven en Railway y en el `.env` local, nunca en git):

- `horex-api`: `DATABASE_URL` (Neon con pooler), `JWT_SECRETO`, `PORT=8080`, `NODE_ENV=production`, `TZ=America/Merida`
- `horex-web`: `API_INTERNA=http://${{horex-api.RAILWAY_PRIVATE_DOMAIN}}:${{horex-api.PORT}}`

Repositorio: https://github.com/Saraseit/horex (privado). `horex-web` despliega la rama `main` en cada push
(`npm run build` y `npm start`, healthcheck `/salud`). `horex-api` se conecta en la Fase 3, cuando exista
la API.

## Capturas de referencia

`docs/referencia/capturas/` tiene las 7 vistas de la demo a 1366 y 400 px, en claro y oscuro, más las
variantes de supervisor de Semana, Empleados y Tarifas (34 en total). Se regeneran con
`node scripts/capturar-referencia.cjs` (Playwright 1.64, Chromium).

## Decisiones tomadas

- **Neon en lugar de Supabase** (decisión del usuario). Sin Supabase no hay Auth ni API automática, así
  que hay una **API propia en Node** (decisión del usuario) y el login es propio: correo y contraseña,
  sesión en cookie httpOnly firmada con `JWT_SECRETO`. Los usuarios los da de alta un script (no hay
  registro público).
- **Web y API en Railway**, en el mismo proyecto (decisión del usuario; el prompt decía Vercel).
- `horex-web` reenvía `/api/*` a `horex-api` por la red privada de Railway. Así navegador y API
  comparten origen: la cookie de sesión es de primera parte, no hace falta CORS y la API no queda
  expuesta a internet.
- **La lógica sigue en Postgres** como pide el prompt: `calcular_tarifa`, triggers y RLS. Donde el prompt
  usa `auth.uid()`, se usará una función que lee el usuario que la API fija en cada transacción
  (`set_config('horex.usuario_id', …, true)`). En la Fase 2 la API pasará a conectarse con un rol propio
  sin privilegios de dueño, para que RLS aplique de verdad; hoy `DATABASE_URL` usa `neondb_owner`.
- **Los registros arrancan en blanco** (decisión del usuario): no se migra el histórico de la hoja
  `DATABASE`. Del Excel sólo se cargan los empleados y las reglas de negocio (tipos de hora y tarifas
  de la hoja `config`: 60, 60, 80, 80, 30, 40, iguales a la demo). El script de la Fase 8 se reduce a eso.
  Si algún día se importa el histórico, cada fila guardará tarifa = importe ÷ horas para que el total
  cuadre con el Excel (aprobado por el usuario).
- `scripts/semilla-demo.js` (datos de prueba de la demo) es sólo para desarrollo y pruebas visuales;
  nunca se corre contra la base de producción.
- **Una sola usuaria por ahora: Mirian Dzul, con rol Supervisor**, porque también captura y no tiene
  auxiliar. Gerardo Itzá es supervisor de operaciones, no de nómina, y no tiene acceso. Los dos roles
  se quedan en el modelo para cuando haya una capturista.
- **Todas las reglas de negocio se editan desde "Tarifas y reglas"** (decisión del usuario: en nómina
  se hacen cambios a mano): tarifa de cada tipo de hora, monto de alimentos, tarifa de domingo del
  eventual y los valores "por confirmar". Los cambios aplican a capturas nuevas; nunca recalculan
  registros guardados.
- **Tarifa manual por registro, como opción** (decisión del usuario): por defecto la tarifa la calcula la
  base; el supervisor podrá poner otra en un registro concreto, con nota obligatoria, y el registro saldrá
  marcado en los reportes. Entra con la base de datos (Fase 2) y la captura real (Fase 4).
- Empleados iniciales: los 25 activos de la demo. Mirian corrige o agrega los que falten desde
  Empleados (el usuario lo prefirió así a depurar la lista del Excel).
- **Las semanas son de lunes a domingo y ningún reporte las corta** (decisión del usuario). Los rangos se
  eligen por semana. Un mes son las semanas con su jueves en ese mes (criterio ISO); así cada semana cae
  completa en un solo mes.
- **Borrado masivo** con casillas en Semana actual y Por empleado (decisión del usuario), sólo supervisor,
  todo o nada, nunca en semanas cerradas. El borrado sigue siendo lógico: el registro conserva quién y
  cuándo lo eliminó.
- Los Excel con datos de nómina (`docs/*.xlsx`) no se suben al repositorio.
- **Fase 1:** las vistas leen de `src/datos/consultas.js`, que por ahora usa un almacén en memoria
  (`almacenPrueba.js`) que imita a la base: calcula la tarifa al guardar, rechaza semanas cerradas, fechas
  futuras y empleados inactivos, y borra de forma lógica. En las fases 2–4 sólo cambia la fuente de
  datos; las vistas no.
- "Hoy" está fijo en el 10 oct 2026 (`src/configuracion.js`) para que la app se vea como la demo con sus
  datos. En la Fase 4 se calcula con la hora de Mérida (`hoyMerida()` ya existe y tiene pruebas).
- La web se sirve con `servidor.js` (sólo módulos de Node) y no con el modo estático de Railway: así las
  rutas del cliente, la caché y, en la Fase 3, el reenvío de `/api` quedan bajo nuestro control.
- `@playwright/test` está fijo en 1.64.0: las referencias visuales se tomaron con su Chromium.
- La semana se calcula con `extract(isoyear/week from fecha)`: verificado en Neon, el 10 oct 2026 es la
  semana 41, igual que en la demo.
