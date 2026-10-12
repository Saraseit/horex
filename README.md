# Horex

Control de horas extra y alimentos del personal operativo. Reemplaza el Google Sheets de nómina.
El plan completo está en [docs/PROMPT_HOREX.md](docs/PROMPT_HOREX.md); la demo de referencia, en
[docs/referencia/horex-demo.html](docs/referencia/horex-demo.html).

**Estado:** fases 1 a 3 terminadas.
- **Fase 1:** las 7 pantallas con la apariencia de la demo.
- **Fase 2:** base de datos en Neon con las reglas, los permisos y las pruebas.
- **Fase 3:** API, inicio de sesión y roles.

Falta la Fase 4: las pantallas todavía leen los datos de prueba de la demo, en memoria, y no la base.

## Cómo correrlo

Requiere Node 22.12 o más nuevo.

```bash
npm install && npm --prefix api install
npx playwright install chromium   # sólo la primera vez, para las pruebas de navegador
cp .env.example .env              # y llenar las cadenas de Neon (ver el archivo)
npm run dev:api                   # API en http://localhost:8080 contra la rama "desarrollo" de Neon
npm run dev                       # web en http://localhost:5173 (reenvía /api a la API local)
```

En desarrollo se entra con los usuarios de prueba de la rama `desarrollo` (`supervisor@prueba.horex`,
`capturista@prueba.horex`; contraseña en `.env`, `CONTRASENA_PRUEBA`).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Compila a `dist/` |
| `npm start` | Sirve `dist/` con `servidor.js` (lo que corre en Railway) |
| `npm run dev:api` | API local (se reinicia sola al guardar) |
| `npm run lint` | ESLint |
| `npm test` | Vitest: lógica (reglas, fechas, formato, agregados, exportación) y, si `.env` tiene la rama `desarrollo`, la base (RLS, triggers, tarifas) y la API (sesión) |
| `npm run test:e2e` | Playwright: comparaciones visuales contra la demo, flujos y sesión (la API se simula) |
| `npm run capturas:referencia` | Vuelve a tomar las capturas de la demo (`--pruebas` para las de la prueba visual) |
| `npm run db:migrar -- --destino desarrollo\|produccion [--semilla]` | Aplica las migraciones pendientes (y la semilla) |
| `npm run db:rol-api -- --destino …` | Contraseña nueva para el rol `horex_api`; guarda su cadena en `.env` |
| `npm run db:semilla-demo -- --destino desarrollo [--reiniciar]` | Datos de la demo y usuarios de prueba. Se niega a correr en producción |
| `npm run db:crear-usuario -- --destino … --correo … --nombre "…" --rol SUPERVISOR\|CAPTURISTA` | Alta de usuario (ver abajo) |

## Base de datos

- `db/migraciones/`: esquema (0001), reglas y triggers (0002), permisos y RLS (0003). Se aplican en orden
  con `npm run db:migrar`; quedan anotadas en la tabla `esquema_migraciones`.
- `db/semilla.sql`: los 6 tipos de hora, los parámetros (alimento $50, domingo eventual $70) y los 25
  empleados activos. No duplica si se corre otra vez.
- Ramas de Neon: `production` (la de verdad, registros en blanco) y `desarrollo` (copia con los datos de la
  demo, para programar y para las pruebas). Cada una tiene su contraseña del rol `horex_api`.
- La API se conecta como `horex_api`, que no es dueño de nada: RLS y los permisos por columna le aplican
  siempre. El dueño (`neondb_owner`) sólo lo usan los scripts.

### Dar de alta usuarios

No hay registro público. Quien administre corre:

```bash
npm run db:crear-usuario -- --destino produccion --correo ana@empresa.mx --nombre "Ana Pérez" --rol CAPTURISTA
```

Genera una contraseña tipo `Horex-XXXX-XXXX-XXXX` y la muestra una sola vez. Con `--contrasena "…"` se
fija una; con el mismo correo se actualiza (sirve para cambiar contraseña o rol); `--desactivar` le quita el
acceso al instante (la API revisa en cada petición que el usuario siga activo).

## Estructura

```
src/
  main.jsx, App.jsx           rutas
  configuracion.js            "hoy" fijo en 2026-10-10 mientras se usan los datos de la demo
  estilos/                    CSS portado de la demo: tokens, base, layout, componentes
  componentes/                Shell, Sidebar, Topbar, Tarjeta, Tabla, Kpi, BuscadorEmpleado, Toast…
  vistas/                     Registrar, Semana, ReporteEmpleado, ReportePeriodo, Exportar, Empleados, Tarifas
  datos/                      api.js (cliente de /api), consultas.js (hooks de React Query), datos y almacén de prueba
  logica/                     funciones puras con pruebas: reglas, casosTarifa, fechas, formato, agregados, exportar
  sesion/                     ProveedorSesion (GET /api/sesion), RutaProtegida
api/                          API (Express + pg): app.js, bd.js, sesion.js, contrasenas.js, pruebas
db/                           migraciones/, semilla.sql, pruebas/ (RLS, triggers y tarifas contra Neon)
servidor.js                   sirve dist/ en Railway y reenvía /api a horex-api
tests/e2e/                    Playwright: visual, flujos, sesión y referencias de la demo
scripts/                      migrar, crear-rol-api, crear-usuario, semilla-demo, capturar-referencia
docs/                         prompt, demo, capturas, briefing, criterios y diferencias visuales
```

Las diferencias con la demo, y por qué existen, están en
[docs/DIFERENCIAS_VISUALES.md](docs/DIFERENCIAS_VISUALES.md).

## Infraestructura

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Neon, proyecto `horex` (`damp-thunder-68675962`) | Postgres 18, AWS us-east-2, base `neondb`, ramas `production` y `desarrollo` |
| API | Railway, proyecto `horex`, servicio `horex-api` | Node + Express (`api/`). Sin dominio público: sólo la alcanza `horex-web` por la red privada |
| Web | Railway, proyecto `horex`, servicio `horex-web` | React + Vite. https://horex-web-production.up.railway.app |

Variables en Railway (los valores viven en Railway y en el `.env` local, nunca en git):

- `horex-api`: `DATABASE_URL` (rol `horex_api`, rama production, con pooler), `JWT_SECRETO`, `PORT=8080`, `NODE_ENV=production`, `TZ=America/Merida`
- `horex-web`: `API_INTERNA=http://${{horex-api.RAILWAY_PRIVATE_DOMAIN}}:${{horex-api.PORT}}`

Repositorio: https://github.com/Saraseit/horex (privado). Los dos servicios despliegan la rama `main` en cada
push: `horex-web` desde la raíz (`npm run build`, arranca con `node servidor.js`) y `horex-api` desde `api/`
(arranca con `node index.js`, sólo cuando cambia `api/`). Los dos tienen healthcheck en `/salud` y corren en
la región `iad` (Virginia), la más cercana a Neon (us-east-2).

Se arrancan con `node` directo y no con `npm start`: al redesplegar o mover de región, Railway manda SIGTERM;
npm lo reporta como error y el despliegue queda marcado como caído. Los dos servidores atienden SIGTERM y
salen limpios.

## Capturas de referencia

`docs/referencia/capturas/` tiene las 7 vistas de la demo a 1366 y 400 px, en claro y oscuro, más las
variantes de supervisor de Semana, Empleados y Tarifas (34 en total). Se regeneran con
`node scripts/capturar-referencia.cjs` (Playwright 1.64, Chromium).

## Decisiones tomadas

- **Neon en lugar de Supabase** (decisión del usuario). Sin Supabase no hay Auth ni API automática, así
  que hay una **API propia en Node** (decisión del usuario) y el login es propio: correo y contraseña,
  sesión en cookie httpOnly firmada con `JWT_SECRETO`. Los usuarios los da de alta un script (no hay
  registro público).
- **Sesión:** cookie `horex_sesion` (JWT HS256, 7 días, `HttpOnly`, `SameSite=Strict`, `Secure` en
  producción). En cada petición la base confirma que el usuario sigue activo. Contraseñas con scrypt; tras 10
  intentos fallidos con un correo, 15 minutos de espera. Las peticiones que cambian algo deben ser JSON.
- **Contraseñas aparte:** viven en la tabla `credenciales`, a la que la API no tiene acceso; el login usa
  `credenciales_para_login()`, la única función que las lee.
- **Web y API en Railway**, en el mismo proyecto (decisión del usuario; el prompt decía Vercel).
- `horex-web` reenvía `/api/*` a `horex-api` por la red privada de Railway. Así navegador y API
  comparten origen: la cookie de sesión es de primera parte, no hace falta CORS y la API no queda
  expuesta a internet.
- **La lógica está en Postgres** como pide el prompt: `calcular_tarifa`, triggers y RLS. Donde el prompt
  usa `auth.uid()`, la base usa `usuario_actual()`, que lee el usuario que la API fija en cada transacción
  (`set_config('horex.usuario_id', …, true)`). La API se conecta con el rol `horex_api`, sin privilegios de
  dueño, y se niega a arrancar si le dan la cadena del dueño.
- **Además de lo que pide el prompt**, la base: sólo permite como "edición" el borrado lógico (cualquier otro
  cambio a un registro se rechaza), exige horas > 0 cuando hay tipo de hora, no deja cerrar semanas que no
  han empezado y valida nombres de empleado únicos sin importar mayúsculas, acentos ni espacios.
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
  marcado en los reportes. La base ya lo soporta (`tarifa_manual` + `nota`); la pantalla llega en la Fase 4.
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
  rutas del cliente, la caché y el reenvío de `/api` quedan bajo nuestro control.
- **Fase 3:** el login y los roles ya son reales, pero los datos de las pantallas siguen siendo los de la
  demo, en memoria, hasta la Fase 4. Lo que se capture hoy en producción no se guarda.
- `@playwright/test` está fijo en 1.64.0: las referencias visuales se tomaron con su Chromium.
- La semana se calcula con `extract(isoyear/week from fecha)`: verificado en Neon, el 10 oct 2026 es la
  semana 41, igual que en la demo.
