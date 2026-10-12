# Horex

Control de horas extra y alimentos del personal operativo. Reemplaza el Google Sheets de nómina.
El plan completo está en [docs/PROMPT_HOREX.md](docs/PROMPT_HOREX.md); la demo de referencia, en
[docs/referencia/horex-demo.html](docs/referencia/horex-demo.html).

**Estado:** Fase 0 (referencia) terminada y revisada. Todavía no hay código de la app.

## Infraestructura

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Neon, proyecto `horex` (`damp-thunder-68675962`) | Postgres 18, AWS us-east-2, rama `production`, base `neondb` |
| API | Railway, proyecto `horex`, servicio `horex-api` | Node. Sin dominio público: sólo la alcanza `horex-web` por la red privada |
| Web | Railway, proyecto `horex`, servicio `horex-web` | React + Vite. https://horex-web-production.up.railway.app |

Variables en Railway (los valores viven en Railway y en el `.env` local, nunca en git):

- `horex-api`: `DATABASE_URL` (Neon con pooler), `JWT_SECRETO`, `PORT=8080`, `NODE_ENV=production`, `TZ=America/Merida`
- `horex-web`: `API_INTERNA=http://${{horex-api.RAILWAY_PRIVATE_DOMAIN}}:${{horex-api.PORT}}`

Repositorio: https://github.com/Saraseit/horex (privado). Los dos servicios de Railway se conectan a él
cuando haya una app que compilar (cierre de la Fase 1).

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
- Los Excel con datos de nómina (`docs/*.xlsx`) no se suben al repositorio.
- La semana se calcula con `extract(isoyear/week from fecha)`: verificado en Neon, el 10 oct 2026 es la
  semana 41, igual que en la demo.
