# Horex — Prompt de construcción para Claude Code

> Cómo usarlo: crea la carpeta del proyecto, copia `horex-demo.html` en `docs/referencia/horex-demo.html` (y, si los tienes, `Horex_Briefing.docx` y `CRITERIOS_DE_HE.docx` en `docs/`). Guarda este archivo como `docs/PROMPT_HOREX.md` y dile a Claude Code: **"Lee docs/PROMPT_HOREX.md y empieza por la Fase 0."**

---

## 0. Tu rol y cómo vamos a trabajar

Vas a construir **Horex**, una web app de control de horas extra que reemplaza un Google Sheets usado por la encargada de nómina de una empresa de logística y distribución en Mérida, Yucatán.

Ya existe una **demo HTML funcional** en `docs/referencia/horex-demo.html`. Esa demo es la **fuente de verdad visual y de comportamiento**. Tu trabajo es convertirla en una app real con base de datos, autenticación y roles **sin cambiar cómo se ve ni cómo se usa**. Si algo de este prompt contradice la demo en lo visual, gana la demo; si contradice la demo en reglas de negocio o datos, gana este prompt.

Reglas de trabajo:

1. **Lee la demo completa antes de escribir código** (CSS, HTML y JS). Ábrela en el navegador con Playwright y toma capturas de las 7 pestañas a 1366 px y 400 px de ancho; guárdalas en `docs/referencia/capturas/`. Esas capturas son el estándar contra el que vas a comparar.
2. Trabaja **por fases** (sección 9). Al terminar cada fase: corre lint y pruebas, muéstrame qué hiciste, y **detente a esperar mi visto bueno** antes de seguir.
3. Todo en **español**: textos de la UI, nombres de componentes, variables, funciones, columnas de la base, comentarios y mensajes de commit. Excepción: palabras reservadas y nombres de librerías.
4. **No inventes reglas de negocio.** Donde la sección 5 dice "por confirmar", deja la regla parametrizada y marcada en la UI como en la demo; no adivines.
5. Haz commits pequeños y descriptivos al final de cada paso lógico (`feat: captura de registros con validación de duplicados`, etc.).

---

## 1. Contexto del negocio (resumen)

- La encargada de nómina captura cada semana las horas extra y los alimentos de ~25 operativos. Hoy lo hace en un Sheets con hojas `config`, `Empleados`, `Captura de horas`, `DATABASE` y `REPORTE`. La hoja `REPORTE` está vacía: armar el reporte semanal para pagar es el mayor dolor.
- **Periodo de pago = semana ISO** (lunes a domingo), igual que `ISOWEEKNUM` del Excel.
- Usuarios: **Capturista** (la nominista, captura todo el día) y **Supervisor** (corrige, cierra semanas, administra catálogos y tarifas).
- Prioridades del usuario, en orden: captura rápida y sin errores → reportes por periodo y por empleado → historial y respaldo confiable.

---

## 2. Stack (no lo cambies sin preguntarme)

| Capa | Elección |
|---|---|
| Frontend | React 18 + Vite, **JavaScript (JSX)** — no TypeScript |
| Ruteo | `react-router-dom` |
| Datos remotos | `@supabase/supabase-js` + `@tanstack/react-query` |
| Backend / BD / Auth | Supabase (Postgres + Auth + RLS) |
| Estilos | **CSS plano portado de la demo** (sin Tailwind, sin librerías de componentes, sin CSS-in-JS) |
| Fuentes | `@fontsource/inter` y `@fontsource/jetbrains-mono` (400–700) |
| Fechas | `date-fns` (con locale `es`) |
| Exportar | `exceljs` para .xlsx; CSV a mano |
| Pruebas | Vitest (lógica pura) + Playwright (flujos y comparación visual) |
| Hosting | Vercel |

Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Crea `.env.example`; nunca subas `.env`.

---

## 3. Conservar el componente visual (lo más importante)

La app debe verse **igual que la demo**, pixel a pixel hasta donde sea razonable.

### 3.1 Estilos
- Copia **literalmente** el bloque `:root { ... }` de tokens, el bloque `@media (prefers-color-scheme: dark)` y el bloque `:root[data-theme="dark"]` a `src/estilos/tokens.css`. No renombres ni "mejores" colores.
- Porta el resto del CSS de la demo a:
  - `src/estilos/base.css` (reset, `[hidden]{display:none!important}`, body, tipografía, `.mono`, `.muted`, `.faint`)
  - `src/estilos/layout.css` (`.app`, `.sidebar`, `.main`, `.topbar`, `.content`, `.view`, grids)
  - `src/estilos/componentes.css` (todo lo demás)
- Conserva los **mismos nombres de clase** que la demo (`.card`, `.kpi`, `.kpi.hero`, `.tbl`, `.tipo-btn`, `.alimento-toggle`, `.resumen-total`, `.vbars`, `.hbar-row`, `.seg`, `.switch`, `.badge`, `.tipo-pill`, `.meals`, `.alert`, `.toast`, etc.). Así el CSS se porta sin reescribirse.
- Conserva los breakpoints de la demo: 1080 px (captura y grid 2:1 a una columna) y 860 px (sidebar se vuelve barra horizontal desplazable arriba, KPIs a 2 columnas), 480 px.
- Modo oscuro automático por `prefers-color-scheme`, igual que la demo.

### 3.2 Componentes React a extraer de la demo

Crea estos componentes en `src/componentes/` reproduciendo el marcado exacto de la demo:

| Componente | Origen en la demo |
|---|---|
| `Shell` | `.app` = `Sidebar` + `.main` (`Topbar` + `.content` con `<Outlet/>`) |
| `Sidebar` | logo "H Horex" + subtítulo, secciones Captura / Reportes / Catálogos, chip de usuario. **Quita el selector Capturista/Supervisor**: el rol viene de la sesión. Agrega botón "Cerrar sesión" en el pie con el mismo estilo de `.role-seg`. |
| `Topbar` | título de la vista + `.semana-tag` ("Semana 41 · 2026", calculada) + botón "Ver semana" |
| `Tarjeta` | `.card` con `.card-header` (título, subtítulo, acción opcional a la derecha) y `.card-body` |
| `EncabezadoVista` | `.view-head` (h2, línea de subtítulo con badges, `.toolbar` a la derecha) |
| `Kpi`, `FilaKpis` | `.kpis` / `.kpi` / `.kpi.hero` |
| `Tabla` | `.tbl-wrap` + `.tbl`, con soporte de `tfoot`, columnas `num`/`ctr`, filas clicables |
| `BarrasVerticales` | `.vbars` (barra de la semana actual en `--bar-2`) |
| `BarrasHorizontales` | `.hbars` / `.hbar-row` |
| `BarraDividida` | `.split` + `.legend` (fijo vs eventual) |
| `Segmentado` | `.seg` |
| `Interruptor` | `.switch` |
| `Insignia` | `.badge` (variantes `ok`, `warn`, `amber`, `grey`) |
| `PildoraTipo` | `.tipo-pill` (variantes `especial`, `muerta`, `sinhe`) |
| `Alimentos` | `.meals` (D / A / C) |
| `Alerta` | `.alert` (`warn`, `ok`, `info`, `amber`) |
| `Toast` + `useToast()` | `.toast` — un proveedor global; mismo texto y duración (2.6 s) que la demo |
| `BuscadorEmpleado` | `.employee-field` + `.employee-dropdown`: búsqueda desde 2 letras, por varias palabras, sin acentos, navegación con ↑ ↓ Enter Esc, solo empleados activos, máximo 8 resultados |
| `ConfirmacionEnLinea` | patrón "¿Eliminar? Sí / No" de la demo (no uses `window.confirm`) |

### 3.3 Iconos
Mantén los mismos caracteres de la demo en la navegación (⏱ ▦ ◉ ▤ ⇩ ☰ $) y en alimentos (☕ 🥗 🌙). No metas librerías de iconos.

---

## 4. Modelo de datos (Supabase)

Escribe las migraciones en `supabase/migrations/` (usa la CLI de Supabase). Nombres en español y snake_case.

```sql
-- Usuarios de la app (perfil ligado a auth.users)
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('CAPTURISTA','SUPERVISOR')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table empleados (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  puesto text not null,
  grupo text not null check (grupo in ('P. Fijo','Eventual')),
  reclutador text not null check (reclutador in ('FIJO','EVENTUAL')),
  imss boolean not null default true,
  genera_he boolean not null default true,   -- false para Coordinador de Operaciones y Almacenista
  activo boolean not null default true,      -- nunca se borran empleados
  created_at timestamptz not null default now()
);

create table tipos_hora (
  clave text primary key,          -- NORMAL_LOCAL, NORMAL_FORANEA, ESPECIAL_LOCAL, ESPECIAL_FORANEA, MUERTA, MUERTA_ESPECIAL
  etiqueta text not null,
  tarifa numeric(8,2) not null check (tarifa >= 0),
  descripcion text not null,
  orden int not null
);

create table parametros (
  clave text primary key,          -- monto_alimento = 50, tarifa_domingo_eventual = 70
  valor numeric(8,2) not null
);

create table registros_horas (
  id bigint generated always as identity primary key,
  empleado_id bigint not null references empleados(id),
  fecha date not null,
  anio_iso int generated always as (extract(isoyear from fecha)::int) stored,
  semana int generated always as (extract(week from fecha)::int) stored,
  tipo_clave text references tipos_hora(clave),       -- null = "Solo alimentos"
  horas numeric(4,1) not null default 0 check (horas >= 0 and horas <= 16),
  tarifa_aplicada numeric(8,2) not null default 0,    -- inmutable: se fija al insertar
  desayuno boolean not null default false,
  almuerzo boolean not null default false,
  cena boolean not null default false,
  monto_alimento numeric(8,2) not null,               -- copia del parámetro vigente al insertar
  importe_he numeric(10,2) generated always as (horas * tarifa_aplicada) stored,
  importe_alimentos numeric(10,2) generated always as (
    ((desayuno::int) + (almuerzo::int) + (cena::int)) * monto_alimento) stored,
  total numeric(10,2) generated always as (
    horas * tarifa_aplicada + ((desayuno::int) + (almuerzo::int) + (cena::int)) * monto_alimento) stored,
  capturado_por uuid not null references usuarios(id) default auth.uid(),
  created_at timestamptz not null default now(),
  eliminado_at timestamptz,                            -- borrado lógico
  eliminado_por uuid references usuarios(id),
  check (tipo_clave is not null or horas = 0),
  check (tipo_clave is not null or desayuno or almuerzo or cena)
);
create index on registros_horas (anio_iso, semana) where eliminado_at is null;
create index on registros_horas (empleado_id, fecha) where eliminado_at is null;

create table semanas_cerradas (
  anio_iso int not null,
  semana int not null,
  cerrada_por uuid not null references usuarios(id) default auth.uid(),
  cerrada_at timestamptz not null default now(),
  primary key (anio_iso, semana)
);

-- Vista para reportes y exportación
create view v_registros with (security_invoker = true) as
select r.*, e.nombre, e.puesto, e.grupo, e.reclutador, e.imss,
       coalesce(t.etiqueta, 'Solo alimentos') as tipo_etiqueta,
       u.nombre as capturado_por_nombre
from registros_horas r
join empleados e on e.id = r.empleado_id
left join tipos_hora t on t.clave = r.tipo_clave
join usuarios u on u.id = r.capturado_por
where r.eliminado_at is null;
```

### 4.1 Lógica en la base (fuente de verdad)
- Función `calcular_tarifa(p_empleado_id, p_fecha, p_tipo_clave) returns numeric` con las reglas de la sección 5.
- Trigger `BEFORE INSERT` en `registros_horas` que:
  - si el empleado tiene `genera_he = false`: fuerza `tipo_clave = null`, `horas = 0`, `tarifa_aplicada = 0`;
  - si no: **ignora la tarifa que mande el cliente** y fija `tarifa_aplicada = calcular_tarifa(...)`;
  - fija `monto_alimento` desde `parametros`;
  - rechaza la inserción si la semana está en `semanas_cerradas`, si la fecha es futura (zona `America/Merida`) o si el empleado está inactivo.
- Trigger `BEFORE UPDATE` que impide cambiar `tarifa_aplicada`, `monto_alimento`, `empleado_id`, `fecha` y `capturado_por` (las correcciones se hacen eliminando y recapturando).
- Cambiar `tipos_hora.tarifa` **nunca** recalcula registros existentes.

### 4.2 RLS (actívala en todas las tablas)
- Función `es_supervisor()` (`security definer`, `stable`) que lee `usuarios.rol` del `auth.uid()` y exige `activo = true`.
- Cualquier usuario activo: `select` en `empleados`, `tipos_hora`, `parametros`, `registros_horas`, `semanas_cerradas`, `usuarios` (solo id, nombre, rol).
- `insert` en `registros_horas`: cualquier usuario activo, con `capturado_por = auth.uid()`.
- `update` en `registros_horas` (borrado lógico): solo supervisor y solo si la semana no está cerrada.
- `insert/update` en `empleados` y `update` en `tipos_hora` y `parametros`: solo supervisor.
- `insert` en `semanas_cerradas`: solo supervisor. Nadie hace `delete` desde el cliente.

### 4.3 Semillas
- `supabase/seed.sql`: los 6 tipos de hora (60, 60, 80, 80, 30, 40, con las descripciones de la demo), parámetros (`monto_alimento = 50`, `tarifa_domingo_eventual = 70`) y los **25 empleados activos** de la demo con puesto, grupo, reclutador e IMSS exactos (Gerardo Itza y Eric Echeverria con `genera_he = false`).
- `scripts/semilla-demo.js` (solo desarrollo): reproduce los datos de prueba de la demo (semanas 38–41 de 2026, generador `mulberry32` con semilla 2026, mismas probabilidades) para que los reportes se vean igual que en la demo.

---

## 5. Reglas de negocio

Implementa estas reglas **dos veces y con las mismas pruebas**: en SQL (`calcular_tarifa`, autoritativa) y en `src/logica/reglas.js` (solo para la vista previa en vivo del formulario). Escribe `src/logica/reglas.test.js` con un caso por fila de la tabla.

| Situación | P. Fijo | Eventual |
|---|---|---|
| Lunes a sábado, tipo Normal (local o foránea) | $60 | $60 |
| Tipo Especial entre semana (hora 11 en adelante) | $80 | **por confirmar** → usa $80 y deja nota |
| Domingo, tipo Especial | $80 | $70 (`parametros.tarifa_domingo_eventual`) |
| Muerta | $30 | $30 |
| Muerta especial (hora 11+ o domingo) | $40 | **por confirmar** → usa $40 y deja nota |

Otras reglas:
- Horario base: lunes a miércoles 8:00–17:00; jueves a sábado 8:00–18:00; domingo descanso.
- Desayuno $50 si entró a las 6:00 o antes. Cena $50 si salió a las 22:00 o después. Almuerzo $50, criterio **por confirmar**. En esta versión los alimentos se marcan a mano.
- Coordinador de Operaciones y Almacenista **no generan HE** pero sí alimentos (`genera_he = false`).
- Duplicado (mismo empleado y fecha): **avisar, no bloquear**.
- Semana = semana ISO. La "semana actual" se calcula con la fecha de hoy en `America/Merida`.
- **Manejo de fechas**: trabaja las fechas como texto `yyyy-MM-dd`. Nunca hagas `new Date('2026-10-10')` (lo interpreta en UTC y en Mérida cae en el día anterior). Usa `parseISO`/`format` de date-fns o el helper `parseD` de la demo.

Pendientes que **no debes resolver tú** (se muestran en Tarifas tal como en la demo):
1. La hora 11, ¿por jornada continua o acumulada en la semana?
2. ¿Qué distingue foránea de local si cuestan igual?
3. ¿Cuándo aplica el almuerzo?
4. ¿El eventual cobra distinto sábados u hora 11+?
5. ¿Quién decide que una hora es "muerta"?
6. ¿Hay registros confiables de checador? (Si sí, en una fase futura el cálculo será automático desde entrada/salida.)

---

## 6. Rutas y pantallas

| Ruta | Pantalla (mismo nombre que la pestaña de la demo) |
|---|---|
| `/login` | Inicio de sesión |
| `/registrar` (inicio) | Registrar HE |
| `/semana/:anio?/:semana?` | Semana actual |
| `/reportes/empleado/:id?` | Por empleado |
| `/reportes/periodo?desde=&hasta=` | Por período |
| `/exportar` | Exportar |
| `/catalogos/empleados` | Empleados |
| `/catalogos/tarifas` | Tarifas y reglas |

Todas excepto `/login` exigen sesión y usuario activo. El estado de filtros va en la URL (semana, empleado, rango) para poder compartir enlaces.

### 6.1 Login
Tarjeta centrada sobre `--bg`, logo "H Horex" en `--brand`, correo + contraseña, botón `.btn-primary` "Entrar". Errores en `.alert.warn`. Sin registro público: el supervisor da de alta usuarios en Supabase. Si el usuario está inactivo, cerrar sesión y avisar.

### 6.2 Registrar HE — igual a la demo
Distribución: columna de formulario + panel derecho de 340 px (`.capture-grid`).
- **Empleado**: `BuscadorEmpleado`. Al elegir, mostrar `.info-strip` con Puesto, Grupo, IMSS (SI/NO), Reclutador. Si `genera_he = false`: `Alerta amber` "X no genera horas extra. Solo registra desayuno o cena si aplica.", deshabilitar horas y tipos.
- **Horas extra**: Horas (número, paso 0.5, 0–16) y Fecha (por defecto hoy, máximo hoy). Botones de tipo en rejilla 3×2 con la **tarifa calculada para ese empleado y fecha** debajo del nombre. En domingo: `Alerta info` del domingo y botones Especial con borde punteado ámbar (`.suggest`).
- **Alimentos**: tres toggles de $50 (accesibles con teclado).
- **Resumen**: Empleado, Fecha, Horas × tarifa, Importe HE, Alimentos, total en `.resumen-total`; nota de regla aplicada (`.regla-note`). "Guardar registro" deshabilitado hasta que sea válido.
- **Duplicado**: si ya hay registro ese día, `Alerta warn` con nombre y fecha.
- **Al guardar**: insertar; si la base rechaza (semana cerrada, fecha futura) mostrar el mensaje en `Alerta warn`. Si sale bien: toast "Guardado: Nombre · $total", limpiar el formulario **conservando la fecha**, foco de vuelta al buscador, y el registro nuevo aparece arriba de "Registros recientes" con el destello `.hist-item.new`.
- **Registros recientes**: los últimos 7 capturados (de cualquier usuario), con punto de color por tipo.
- Teclado: el flujo completo (buscar → Enter → horas → tipo → guardar) debe poder hacerse sin mouse.

### 6.3 Semana actual — igual a la demo
- Encabezado "Semana N", rango de fechas, insignia **"Abierta · en captura"** o **"Cerrada"** (según `semanas_cerradas`). Flechas ‹ › y selector de semanas con datos.
- Botón **"Cerrar semana"** (solo supervisor, con `ConfirmacionEnLinea`): inserta en `semanas_cerradas`; la semana queda de solo lectura.
- 4 KPIs: Horas extra (n registros), Importe HE (n empleados), Alimentos (n comidas), Total a pagar (hero).
- Tabla empleado × día (Lun–Dom con fecha, domingo sombreado, punto ámbar si hubo alimentos), columnas Horas, Importe HE, Alim., Total y fila de totales. Clic en fila → reporte del empleado.
- Tabla de registros de la semana: fecha, empleado, tipo, horas, tarifa, importe, alimentos, total, quién capturó y acción **Eliminar** (solo supervisor y semana abierta; borrado lógico con `eliminado_por`).

### 6.4 Por empleado — igual a la demo
Selector de empleado (con registros), encabezado con puesto e insignias (grupo, IMSS, "Solo alimentos"), 4 KPIs, barras verticales del total por semana (últimas 4 semanas con datos; actual en ámbar), barras horizontales de horas por tipo e historial completo con totales. Agrega un selector de rango "Últimas 4 semanas / 8 semanas / Este año" (por defecto 4).

### 6.5 Por período — igual a la demo
Botones rápidos (Semana actual, Últimas 4 semanas, mes actual, mes anterior) + fechas desde/hasta. KPIs (incluye tarifa promedio y total de domingos), total por semana, fijo vs eventual con horas de cada grupo y de domingo, desglose por tipo (barras con horas e importe) y top 10 empleados (clic → su reporte).

### 6.6 Exportar — reemplaza a la hoja REPORTE
- Desde semana / hasta semana y formato **Resumen por empleado** o **Detalle (formato DATABASE)**, con las columnas exactas de la demo:
  - Resumen: Nombre, IMSS, Grupo, Reclutador, Horas, Importe HE, Desayunos, Almuerzos, Cenas, $ Alimentos, Total (+ fila TOTAL).
  - Detalle: Nombre, Puesto, Grupo, Reclutador, IMSS, Tipo hora, Semana, Fecha, Horas, Valor hora, Importe horas, Desayuno, Almuerzo, Cena, $ Alimentos.
- Vista previa (primeras 40 filas) y tres botones: **Descargar .xlsx** (exceljs: encabezado en negritas con fondo `--brand`, formato de moneda MXN, columnas autoajustadas, fila de totales, nombre `Horex_Sem38-41_resumen.xlsx`), **Descargar .csv** (UTF-8 con BOM para que Excel respete acentos) y **Copiar tabla para Excel** (TSV al portapapeles con respaldo de `<textarea>` seleccionable, como la demo).

### 6.7 Empleados — igual a la demo
Buscador, filtro Activos / Inactivos / Todos, contador en el subtítulo, tabla (Nombre, Puesto, Grupo, IMSS, Reclutador, Genera HE, Registros, Activo con `Interruptor`). "+ Nuevo empleado" abre el formulario en línea (nombre, puesto, grupo, IMSS, **genera HE**); reclutador se deriva del grupo; rechaza nombres duplicados ignorando mayúsculas y acentos. Capturista: solo lectura con la `Alerta amber` de la demo. Texto al pie: los empleados nunca se borran.

### 6.8 Tarifas y reglas — igual a la demo
Tabla de tipos con tarifa editable (solo supervisor, botón "Guardar cambios", toast con cuántas cambiaron y la nota de que no se recalculan registros), Horario base, Matriz de tarifas (con insignias "Por confirmar"), Alimentos y excepciones (montos desde `parametros`, editables por supervisor) y la lista numerada de pendientes.

### 6.9 Permisos en la UI
Mismo patrón que la demo: las acciones de supervisor se muestran **deshabilitadas** con `title="Solo supervisor"` y una `Alerta amber` explicativa; no se ocultan. La seguridad real está en RLS.

---

## 7. Estructura del proyecto

```
src/
  main.jsx, App.jsx (rutas)
  estilos/ tokens.css, base.css, layout.css, componentes.css
  componentes/ (los de la sección 3.2)
  vistas/ Login.jsx, Registrar.jsx, Semana.jsx, ReporteEmpleado.jsx, ReportePeriodo.jsx, Exportar.jsx, Empleados.jsx, Tarifas.jsx
  datos/ supabase.js, consultas.js (hooks de react-query: useEmpleados, useTipos, useRegistrosSemana, useRegistrosRango, useCrearRegistro, ...)
  logica/ reglas.js, agregados.js (sumar, porDia, porTipo, porGrupo, top), fechas.js (semana ISO, rango, hoyMerida), exportar.js, formato.js (moneda MXN sin decimales, horas "9.5 h")
  sesion/ ProveedorSesion.jsx, RutaProtegida.jsx
supabase/ migrations/, seed.sql
scripts/ semilla-demo.js, importar-excel.js
docs/ referencia/horex-demo.html, referencia/capturas/
tests/ e2e/*.spec.js
```

Las funciones de `src/logica/` son puras y tienen pruebas; las vistas solo componen datos y componentes.

---

## 8. Migración del Excel histórico

`scripts/importar-excel.js` lee la hoja `DATABASE` del archivo original (`docs/Registro_horas_extra.xlsx`) y:
- Empata nombres contra `empleados` normalizando mayúsculas, acentos y espacios. Variantes conocidas: ERIK/ERICK, ISAC/ISAAC, GALUE CETINA en dos formas, MAY CERANTES/CERVANTES.
- **No adivina**: los nombres sin coincidencia segura van a `docs/importacion/pendientes.csv` para que yo los resuelva; no se importan hasta resolverlos.
- Inserta con la **tarifa original del Excel** (no recalcula), con un usuario técnico "Importación" como `capturado_por`.
- Al final imprime un cuadre: total de filas, total importe HE y total alimentos del Excel vs lo importado. Deben coincidir.
- Corre primero con `--simular` (no escribe nada).

---

## 9. Fases (detente al final de cada una)

**Fase 0 — Referencia.** Lee la demo y los documentos de `docs/`. Toma las capturas de referencia. Resúmeme en 10 líneas lo que entendiste y pregúntame lo que no esté claro.

**Fase 1 — Esqueleto visual.** Vite + React + router, CSS portado, `Shell`, `Sidebar`, `Topbar` y los componentes de la sección 3.2 con las 7 vistas alimentadas por **datos de prueba locales** (los mismos de la demo). Criterio: las capturas de Playwright de cada vista a 1366 y 400 px coinciden visualmente con las de referencia (pruebas de captura con `toHaveScreenshot`, tolerancia baja; documenta cualquier diferencia).

**Fase 2 — Base de datos.** Migraciones, funciones, triggers, RLS, `seed.sql`, `semilla-demo.js`. Pruebas SQL (o scripts) que demuestren: tarifa de domingo eventual = 70, tarifa del cliente ignorada, puesto sin HE forzado a 0, semana cerrada rechaza insert, capturista no puede borrar ni editar tarifas.

**Fase 3 — Auth y roles.** Login, sesión, rutas protegidas, chip de usuario y permisos en UI.

**Fase 4 — Captura real.** Registrar HE contra Supabase con todo lo de 6.2.

**Fase 5 — Semana y cierre.** Vista Semana con eliminación y cierre de semana.

**Fase 6 — Reportes y exportación.** Por empleado, por período y Exportar (.xlsx, .csv, copiar).

**Fase 7 — Catálogos.** Empleados y Tarifas editables.

**Fase 8 — Migración y despliegue.** Script de importación, despliegue en Vercel, checklist de producción (variables, RLS revisada con el asesor de seguridad de Supabase, respaldo).

---

## 10. Criterios de aceptación finales

- [ ] Las 7 pantallas se ven como la demo en claro y oscuro, a 1366 px y a 400 px, sin scroll horizontal en el body.
- [ ] Un registro normal se captura en menos de 15 segundos solo con teclado.
- [ ] El total de cualquier semana en Semana actual = el total del .xlsx exportado = la suma de `v_registros` en SQL.
- [ ] Cambiar una tarifa no altera ningún registro anterior.
- [ ] Un capturista no puede, ni desde la UI ni llamando a la API directamente, borrar registros, cerrar semanas ni editar catálogos o tarifas.
- [ ] Una semana cerrada no acepta inserciones ni borrados.
- [ ] `npm run lint`, `npm test` y `npm run test:e2e` pasan.
- [ ] `README.md` en español con instalación, variables, cómo correr migraciones y semillas, y cómo dar de alta usuarios.

**Fuera de alcance por ahora:** cálculo automático desde checador, notificaciones, app móvil nativa, multiempresa, edición de registros (se corrige eliminando y recapturando).
