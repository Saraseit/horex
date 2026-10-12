# Horex

Control de horas extra y alimentos del personal operativo. Reemplaza el Google Sheets de nómina.
El plan completo está en [docs/PROMPT_HOREX.md](docs/PROMPT_HOREX.md); la demo de referencia, en
[docs/referencia/horex-demo.html](docs/referencia/horex-demo.html).

**Estado:** Fase 0 (referencia) terminada. Todavía no hay código de la app.

## Infraestructura

| Pieza | Dónde | Detalle |
|---|---|---|
| Base de datos | Neon, proyecto `horex` (`damp-thunder-68675962`) | Postgres 18, AWS us-east-2, rama `production`, base `neondb` |
| API | Railway, proyecto `horex`, servicio `horex-api` | Node. Sin dominio público: sólo la alcanza `horex-web` por la red privada |
| Web | Railway, proyecto `horex`, servicio `horex-web` | React + Vite. https://horex-web-production.up.railway.app |

Variables en Railway (los valores viven en Railway y en el `.env` local, nunca en git):

- `horex-api`: `DATABASE_URL` (Neon con pooler), `JWT_SECRETO`, `PORT=8080`, `NODE_ENV=production`, `TZ=America/Merida`
- `horex-web`: `API_INTERNA=http://${{horex-api.RAILWAY_PRIVATE_DOMAIN}}:${{horex-api.PORT}}`

Los dos servicios están vacíos hasta conectarlos al repositorio de GitHub.

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
- Los Excel con datos de nómina (`docs/*.xlsx`) no se suben al repositorio.
- La semana se calcula con `extract(isoyear/week from fecha)`: verificado en Neon, el 10 oct 2026 es la
  semana 41, igual que en la demo.
