# Evidencia individual del equipo

> Un solo archivo compartido. Repitan la sección siguiente por cada integrante; cada persona escribe y explica su propia evidencia. Se aceptan evidencias previas equivalentes. El SHA final se entrega en Classroom después del último commit, para evitar modificar el commit que se está identificando.

- **Grupo y equipo:** DMI-EQ11C / PWA-EQ11
- **Repositorio del equipo:** [Enlace al repositorio privado en GitHub]

## Integrante: Danna

- Mi contribución concreta y enlace a archivo, commit anterior o revisión:
  Completé el análisis y la redacción de `docs/requirements.md` (problema y contexto,
  usuarios y escenarios, requisitos funcionales y no funcionales, datos sintéticos y
  límites, y criterios de aceptación de la Semana 1), partiendo de la plantilla del
  starter (commit inicial 8fd7d24) y contrastándola con `ACTIVIDAD-01.md`, `README.md` y
  el código de `src/app/` y `src/lib/data/inspections.ts`. El cambio quedó en el commit
  e97b7e0 («docs: complete product requirements», 100 inserciones / 17 eliminaciones en
  `docs/requirements.md`), rama `feature/requirements-danna`.
  Enlace al commit: https://github.com/DannaTobon/PWA-EQ11/commit/e97b7e0
- Decisión que puedo explicar y por qué:
  Dejé RF-01 como requisito "Ahora" (la consulta del listado sintético ya existe en el
  starter) y RF-02, RF-03 y RF-04 como "Futuro" (registro, conservación offline y
  sincronización), con trazabilidad explícita a los dos escenarios mediante la columna
  "Escenario". Defendí esta separación porque la Actividad 1 exige documentar capacidades
  futuras sin afirmar que están implementadas, y porque las fuentes (ACTIVIDAD-01.md;
  `src/app/page.tsx`) indican que la PWA aún no se implementa.
- Comando o prueba proporcionada que ejecuté:
  `npm run verify` desde la raíz del proyecto, después de completar `docs/requirements.md`.
  Antes también ejecuté `npm ci` y `npm run dev` y comprobé visualmente la pantalla
  inicial en `http://localhost:3000` con las tres inspecciones sintéticas.
- Resultado real que observé:
  `starter.spec.mjs: PASS`; `next build: PASS` (compilación, lint y validación de tipos
  correctas); salida final «Verificación técnica: pass» y «Revisión académica: pendiente».
  Se generó `reports/verification.json`.
- Qué verifica esa prueba y qué no verifica:
  `npm run verify` ejecuta `scripts/verify.mjs`, que (1) comprueba que existan los
  archivos requeridos, (2) corre `npm test` (`tests/starter.spec.mjs`, que valida que el
  script `build` de `package.json` sea `next build` y que `src/app/page.tsx` contenga
  "Inspecciones de laboratorio" y "sintéticos"), y (3) ejecuta `next build`. No verifica
  la calidad del contenido de los documentos (el reporte deja la revisión académica en
  "pendiente"), no certifica ausencia de secretos, no comprueba la instalación (eso es
  `npm ci`, por separado) ni cubre todo el comportamiento de la aplicación ni la futura
  operación offline.
- Limitación, dificultad o riesgo que identifiqué:
  La reproducibilidad declarada en RNF-01 supone una copia limpia con las versiones de
  Node/npm señaladas; no hice esa validación en un clon limpio, así que queda como meta a
  confirmar y no como medición hecha. Además, metas futuras como RNF-04 (listado con 100
  registros en menos de 2 s) son umbrales propuestos, no resultados medidos.
- Uso de IA: herramienta, propósito, partes influenciadas y validación propia:
  Usé OpenCode (asistente de IA en terminal) como apoyo en el análisis, la redacción y
  la estructuración de `docs/requirements.md`. Influyó en la estructura del documento,
  la tabla de requisitos y la trazabilidad mediante la columna "Escenario". Validación
  humana: revisé cada apartado contra `ACTIVIDAD-01.md`, `README.md` y el código del
  starter, y ejecuté `npm run verify` para confirmar el resultado técnico antes de cerrar
  esta sección.

---

## Integrante: Tonanzin

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:**
  Redacción de `docs/decision-record.md` (ADR-001), incluyendo la comparación de las 4 alternativas (PWA, web tradicional, nativa, multiplataforma) y la justificación de la decisión. Commit `04040af12498d83f4def66c439ceeab5b4099c37` en la rama `main`: "docs: agregar ADR-001 sobre estrategia de aplicacion (PWA)".

- **Decisión que puedo explicar y por qué:**
  Elegimos PWA sobre las demás alternativas porque el caso requiere tolerar conectividad intermitente en campo y el equipo debe seguir usando el starter Next.js + React + TypeScript sin duplicar esfuerzo en bases de código nativas. PWA permite mantener un solo código base, distribuirse por URL sin depender de tiendas, y habilita a futuro el registro offline con sincronización posterior — que es justo el escenario descrito en los requisitos del producto. Frente a app nativa, evita el costo de dos bases de código y los tiempos de revisión de tienda, que no encajan con el ritmo semanal del curso.

- **Comando o prueba proporcionada que ejecuté:**
  `npm run verify` sobre mi copia local del proyecto (`PWA-EQ11`).

- **Resultado real que observé:**
  El comando corrió `test` (`starter.spec.mjs: PASS`) y `build` (`next build`, Next.js 14.2.35), compiló correctamente y generó las 4 páginas estáticas sin errores. Salida final: "Verificación técnica: pass. Revisión académica: pendiente." Reporte generado en `reports/verification.json`.

- **Qué verifica esa prueba y qué no verifica:**
  Verifica que el starter compila y pasa sus pruebas técnicas (código de salida correcto, sin errores de build). No verifica la calidad ni la corrección del análisis de alternativas del ADR, ni que la PWA ya funcione offline: eso sigue siendo un juicio de contenido pendiente, distinto de la comprobación técnica.

- **Limitación, dificultad o riesgo que identifiqué:**
  El soporte de PWA es desigual entre navegadores/SO, especialmente en iOS (notificaciones push y persistencia de almacenamiento limitadas). Además, si la estrategia de caché/sincronización no queda bien definida, existe el riesgo de que el usuario crea que su registro se guardó cuando en realidad no se sincronizó — esto todavía no está diseñado ni implementado, es un riesgo a futuro.

- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):**
  Utilicé Claude (Anthropic) como apoyo para estructurar y redactar un primer borrador de `docs/decision-record.md` (la tabla comparativa y la justificación de PWA), a partir de los requisitos y el formato ADR que me proporcionó el equipo. Yo definí el alcance, revisé y ajusté el contenido a las restricciones reales del proyecto (starter Next.js, curso, escenarios), y validé personalmente la parte técnica ejecutando `npm run verify` y haciendo el commit. La decisión y su justificación las puedo explicar y sostener por mi cuenta.

---

## Integrante: Fernando

- **Mi contribución concreta y enlace a archivo, commit anterior o revisión:** 
  Configuración del entorno, actualización de `README.md` y estructura de `evidence/individual.md`. Coordinación técnica y revisión final del equipo.
- **Decisión que puedo explicar y por qué:** 
  La organización del flujo de trabajo y la estructuración para evitar conflictos de integración en Git, separando los archivos que cada integrante editará de forma concurrente.
- **Comando o prueba proporcionada que ejecuté:** 
  `npm ci` y `npm run dev`.
- **Resultado real que observé:** 
  El comando `npm ci` completó la instalación en ~46s generando la carpeta `node_modules` (con advertencias de auditoría esperadas del starter). `npm run dev` arrancó el servidor en `http://localhost:3000` y respondió con HTTP 200 OK.
- **Qué verifica esa prueba y qué no verifica:** 
  `npm ci` asegura una instalación 100% reproducible usando el `package-lock.json`. `npm run dev` prueba que la aplicación arranca y sirve contenido. Estas pruebas **NO** validan que la aplicación sea ya una PWA funcional (falta manifest, service worker), ni valida la calidad de la documentación de mis compañeras.
- **Limitación, dificultad o riesgo que identifiqué:** 
  Existen 2 vulnerabilidades de alta severidad reportadas por npm audit en el starter; decidimos no forzar una actualización (`npm audit fix --force`) para no alterar el starter base ni romper compatibilidad sin previo análisis.
- **Uso de IA: herramienta, propósito, partes influenciadas y validación propia (o «no utilicé IA»):** 
  Utilicé Antigravity (Gemini/Claude) como asistente técnico dentro de mi IDE para leer el entorno, analizar los requisitos de la ACTIVIDAD-01 y generar la plantilla estructural de los documentos. Verifiqué que cada sección cumpla estrictamente con la rúbrica y no implemente funciones futuras no requeridas (como offline o manifiesto).

---

# Evidencia individual — Semana 2

## Integrante: Danna

### 1. Rol / bloque individual

Mi trabajo en la Semana 2 corresponde al **Bloque A**:

- PWA / manifest;
- iconos;
- metadata y viewport;
- estructura inicial de rutas.

El equipo quedó organizado en tres bloques con separación de responsabilidades:
Danna (Bloque A), Fernando (Bloque B: AppShell, UI, estados, accesibilidad,
responsive) y Tonanzin (Bloque C: Vitest, tests, CI, GitHub Actions, calidad).

### 2. Trabajo realizado

**Etapa 1 — manifest, iconos, metadata y viewport**

- Creación de `public/manifest.webmanifest` con los valores aprobados: `name`
  «Inspecciones de laboratorio», `short_name` «Inspecciones», `description`,
  `start_url` `/`, `scope` `/`, `display` `standalone`, `background_color`
  `#f4f7fb`, `theme_color` `#3156d3`, `lang` `es-MX`, `dir` `ltr`, e `icons`
  con `icon-192x192.png` y `icon-512x512.png`.
- Creación de los iconos locales `public/icon-192x192.png` y
  `public/icon-512x512.png` (PNG reales, 192×192 y 512×512, generados mediante
  un script Python local con la biblioteca estándar; sin recursos externos ni
  dependencias nuevas).
- Integración del manifest en `src/app/layout.tsx` mediante la API `metadata`
  de Next.js (`manifest: "/manifest.webmanifest"`).
- Configuración del `viewport` con `width: "device-width"`, `initialScale: 1` y
  `themeColor: "#3156d3"` mediante el export `viewport` de Next.js.
- Se conservó `<body>{children}</body>` sin envolverlo para permitir que
  Fernando integre posteriormente `<AppShell>{children}</AppShell>` sin rehacer
  el trabajo.

**Etapa 2 — estructura inicial de rutas**

- Transformación de `src/app/page.tsx` en una página de bienvenida: presenta el
  propósito de la aplicación y navega hacia `/inspections` y `/maintenance`
  mediante `Link` de `next/link`.
- Creación de la ruta `/inspections` (`src/app/inspections/page.tsx`) con el
  listado de inspecciones y `metadata.title`.
- Creación de la ruta `/maintenance` (`src/app/maintenance/page.tsx`) como
  página base de la sección de mantenimiento, sin API, persistencia ni
  funcionalidad futura, con `metadata.title`.
- Reutilización de `src/lib/data/inspections.ts` sin duplicar los datos
  sintéticos.
- Eliminación en la interfaz de referencias académicas de la Semana 1
  (p. ej. «Proyecto base · Semana 1», «PWA aún no implementada»); la aplicación
  se ve como una aplicación real. No se borró documentación ni evidencia de la
  Semana 1.

### 3. Decisiones técnicas

- Uso del **App Router** de Next.js para las rutas reales `/`, `/inspections` y
  `/maintenance`.
- Navegación interna con `Link` de `next/link` (rutas reales), sin `div` +
  `onClick`, sin `window.location` ni botones simulando navegación.
- Reutilización de la fuente de datos sintéticos existente
  (`@/lib/data/inspections`) en lugar de duplicar los datos.
- Manifest integrado mediante la API de `metadata` de Next.js (no un `<link>`
  manual).
- Iconos PNG locales generados sin dependencias nuevas y sin descargas
  externas.
- Separación de responsabilidades entre los bloques A, B y C. **No** se
  atribuyen a mi bloque: AppShell, estados loading/error/empty/success, Vitest,
  `tests/manifest.spec.ts`, CI ni GitHub Actions (corresponden a Fernando y
  Tonanzin y todavía no forman parte de mi trabajo documentado en estos
  commits).

### 4. Pruebas / verificaciones realizadas

**Etapa 1**

- Validación del JSON de `public/manifest.webmanifest` (parseo correcto y
  coincidencia de todos los campos aprobados).
- Validación de la firma PNG (bytes `89 50 4E 47 0D 0A 1A 0A`) en ambos iconos.
- Verificación de las dimensiones exactas 192×192 y 512×512 (chunk IHDR).
- Decodificación completa de ambos PNG (descompresión del IDAT con `zlib` sin
  errores).
- Revisión de `src/app/layout.tsx`: manifest y viewport configurados sin
  alterar `<body>{children}</body>`.

**Etapa 2**

- `tsc --noEmit` → exit 0 (con el TypeScript ya instalado, sin instalar nada).
- `npm run build` → exit 0; Next.js compiló y registró las rutas estáticas:
  `/`, `/inspections`, `/maintenance`.
- Confirmación de que `/inspections` importa directamente desde
  `@/lib/data/inspections` (import `@/lib/data/inspections`), sin duplicación
  de datos.

Nota: **`npm ci` todavía no se ha ejecutado** en esta etapa del trabajo; la
distribución de la rama aún no se ha probado en un entorno limpio.

### 5. Limitaciones / alcance

- Los datos siguen siendo exclusivamente sintéticos.
- No hay API, fetching, persistencia ni service worker (no corresponden a esta
  etapa del Bloque A).
- Los estados de UI (loading/error/empty/success) corresponden al trabajo
  posterior de Fernando.
- Los tests (`tests/manifest.spec.ts`) y el CI corresponden al Bloque C.
- AppShell todavía será integrado por Fernando; el layout quedó preparado para
  ello. Estas no son fallas: forman parte del alcance acordado entre los
  bloques.

### 6. Uso de IA

Se utilizó OpenCode/IA como apoyo para:

- analizar la estructura existente del proyecto;
- proponer y realizar los cambios dentro del alcance del Bloque A;
- generar los iconos mediante un script local (Python stdlib);
- revisar y verificar los cambios (JSON, PNG, build, rutas);
- ayudar a mantener la separación entre bloques A, B y C.

Las decisiones de alcance, rutas, responsabilidades, diseño, revisión de
cambios y aprobación de commits fueron supervisadas/validadas por el
integrante. La IA no realizó trabajo de otros integrantes.

### 7. Commits de Semana 2

- `a4ded758ccc65af1f9de3c8152de5ab402fc46fe` — `feat(pwa): add manifest, icons and viewport metadata`
- `b56d942dd1c22a8cf0a7b167f74009cbeef26d93` — `feat(routes): add inspections and maintenance routes`

### 8. Separación Semana 1 / Semana 2

La evidencia de la Semana 1 se conserva íntegramente en las secciones
anteriores (`## Integrante: Danna`, «## Integrante: Tonanzin» y
«## Integrante: Fernando»). Esta sección, separada por una línea divisoria con
encabezado propio, documenta únicamente el trabajo de la Semana 2 que consta en
los dos commits indicados. No se mezclan puntos de Semana 2 dentro de las listas
de Semana 1.

---

## Integrante: Tonanzin

### 1. Rol / bloque individual

Mi trabajo en la Semana 2 corresponde al **Bloque C**:

- configuración de Vitest;
- `tests/manifest.spec.ts` (pruebas del manifest PWA);
- pruebas de comportamiento crítico de UI (`AppShell` y los 4 estados);
- workflow de GitHub Actions de Semana 2;
- coordinación de la validación final del equipo.

### 2. Trabajo realizado

**Configuración de Vitest**

- Instalación de Vitest y configuración en `vitest.config.mts`: entorno
  `jsdom`, alias `@/*` apuntando a `src/`, plugin `@vitejs/plugin-react` (para
  transformar JSX, ya que `tsconfig.json` usa `jsx: "preserve"`, pensado para
  el compilador de Next.js y no para Vite), y `tests/setup.ts` con
  `@testing-library/jest-dom` y limpieza automática (`cleanup`) entre pruebas.
- Se agregó el script `test:manifest` en `package.json` (independiente del
  script `test` existente, que sigue corriendo `tests/starter.spec.mjs` de la
  Semana 1) para no romper la validación de mis compañeros.

**`tests/manifest.spec.ts` (6 pruebas)**

Contra `public/manifest.webmanifest` de Danna: existencia del archivo, JSON
válido, `name`/`short_name` no vacíos, `display` = `standalone`, `start_url` y
`scope` como rutas válidas, e íconos 192×192 y 512×512 presentes con
`type: image/png` y archivo real en `public/`.

**Pruebas de comportamiento de UI (13 pruebas)**

- `tests/app-shell.spec.tsx` (4 pruebas): landmarks de accesibilidad
  (`banner`, `navigation`, `main`, `contentinfo`), contenido (`children`)
  dentro del landmark `main`, links de navegación a `/inspections` y
  `/maintenance` con su `href` correcto, y el link de marca hacia `/`.
- `tests/ui-states.spec.tsx` (9 pruebas): `LoadingState` (`role="status"` con
  etiqueta, `aria-live`/`aria-busy`, mensaje visible), `ErrorState`
  (`role="alert"`, mensaje de error entendible, invocación de `reset()` al
  hacer clic en "Reintentar"), y `EmptyState` (título y descripción por
  props, acción opcional renderizada, y que no falle sin `icon` ni `action`).

Estas pruebas se escribieron y validaron contra el contenido real de los
archivos del Bloque B (`app-shell.tsx`, `loading-state.tsx`, `error-state.tsx`,
`empty-state.tsx`) tomados temporalmente de la rama `feature/app-shell-ui` de
Fernando (aún no fusionada a `main` al momento de este commit) solo para
confirmar que las 19 pruebas pasan en verde; esos archivos **no** se
incluyeron en mi commit, ya que pertenecen a su bloque y su PR.

**Workflow de CI (Semana 2)**

- `.github/workflows/week-02-feedback.yml`: en cada push/PR, instala con
  `npm ci`, corre `npm run test:manifest` (Vitest) y `npm run build`, y sube
  el reporte JSON de Vitest como artefacto.

### 3. Decisiones técnicas

- **Downgrade deliberado de versiones**: instalé inicialmente `vitest@5`,
  `jsdom@30` y `@testing-library/jest-dom@7`, pero esas versiones requieren
  Node.js ≥22. Mi máquina (y el CI, configurado con Node `20.19.6`, igual que
  el workflow de Semana 1) usa Node 20, así que downgradeé a `vitest@^3.2.4`,
  `jsdom@^25.0.1`, `@testing-library/jest-dom@^6.6.3`,
  `@vitejs/plugin-react@^4.3.4` y `vite@^5.4.11` — todas con soporte
  explícito para Node 20, evitando forzar una actualización de Node en las
  máquinas de mis compañeros.
- Entorno de pruebas `jsdom` (no `node`) para poder renderizar componentes
  React con `@testing-library/react`.
- Script `test:manifest` separado del script `test` existente, para no
  interferir con `tests/starter.spec.mjs` de la Semana 1 sin acuerdo previo
  del equipo.
- Instalación con `--legacy-peer-deps` por un conflicto de peer dependencies
  entre `vitest` y la versión de `@types/node` ya fijada en el proyecto
  (`^20.14.15`); no se tocó `@types/node` para no afectar la configuración de
  TypeScript compartida.

### 4. Pruebas / verificaciones realizadas

- `npm run test:manifest` → 3 archivos de prueba, **19/19 pruebas en verde**
  (6 de manifest + 4 de AppShell + 9 de estados de UI).
- `npm run build` → exit 0, compiló y generó las 4 rutas estáticas sin
  errores, después de todos los cambios de configuración y dependencias.
- Verifiqué manualmente que ningún paquete del árbol de dependencias (`npm
  ls`) quedara en estado `invalid` o requiriera Node ≥22.

### 5. Limitaciones / alcance

- Las pruebas de `tests/app-shell.spec.tsx` y `tests/ui-states.spec.tsx`
  **fallarán con "módulo no encontrado"** en cualquier copia limpia de
  `main` hasta que se fusione el PR de Fernando (`feature/app-shell-ui`): es
  una dependencia esperada del Bloque C sobre el Bloque B, no un error de mi
  configuración.
  **Actualización posterior:** el PR del Bloque B ya está fusionado en `main` (existen `src/components/app-shell.tsx` y `src/components/ui/*`, integrado en `src/app/layout.tsx`), por lo que esta limitación dejó de aplicar en `main`.
- No se implementaron pruebas de integración de rutas completas
  (`/inspections`, `/maintenance`) ni pruebas end-to-end; el alcance acordado
  para el Bloque C esta semana es manifest + comportamiento de componentes
  aislados.
- El estado `EmptyState` no está conectado todavía a ninguna página real
  (ni `/inspections` ni `/maintenance` lo usan), así que solo se probó el
  componente de forma aislada, no en contexto de una lista vacía real.

### 6. Uso de IA

Utilicé Claude (Anthropic) como apoyo para configurar Vitest y Testing
Library, diagnosticar y resolver los conflictos de versiones con Node 20
(incluyendo la causa raíz del error `webidl.util.markAsUncloneable is not a
function), y redactar el esqueleto inicial de `tests/manifest.spec.ts`,
`tests/app-shell.spec.tsx` y `tests/ui-states.spec.tsx`. Las pruebas se
ejecutaron y validaron en verde antes de incluirlas en el commit; la decisión
de qué comportamiento probar (landmarks, estados, accesibilidad) y el ajuste
de versiones a las restricciones reales del proyecto (Node 20, script `test`
compartido) los revisé y definí yo antes de aceptar el resultado.

### 7. Commits de Semana 2

- `dba8e7f56d2f6093197ddb099dc1ec6d854e1680` — `test: configurar
  Vitest, tests de manifest y comportamiento de UI, workflow CI semana 2`

### 8. Separación Semana 1 / Semana 2

La evidencia de la Semana 1 se conserva íntegramente en la sección
`## Integrante: Tonanzin` anterior (ADR-001 / decision-record.md). Esta
sección documenta únicamente el trabajo del Bloque C de Semana 2.

---

## Integrante: Fernando

### 1. Rol / bloque individual

Mi trabajo en la Semana 2 corresponde al **Bloque B**:

- AppShell (estructura visual común: Header, Navegación, Main, Footer);
- Estados de UI (Loading, Error, Empty, Success);
- Accesibilidad (landmarks semánticos, navegación accesible, focus visible);
- Diseño responsive adaptado a móvil y escritorio;
- Experiencia de usuario y ruta determinista de QA.

### 2. Trabajo realizado

**Etapa 1 — Estructura global y AppShell**
- **Creación del componente `AppShell` (`src/components/app-shell.tsx`):** 
  Se desarrolló la carcasa estructural común de la aplicación. Esta incluye un **Header sticky** persistente en la parte superior para asegurar el acceso rápido a la navegación en todo momento, una sección principal fluida (`<main>`) que aloja el contenido dinámico de cada ruta, y un **Footer** informativo.
- **Navegación accesible y semántica:** 
  Dentro del `AppShell`, se implementó una barra de navegación que enlaza las rutas base del sistema (`/` Inicio, `/inspections` Inspecciones, `/maintenance` Mantenimiento). Se utilizaron etiquetas semánticas de HTML5 (`<header>`, `<nav>`, `<main>`, `<footer>`) y atributos ARIA (`aria-label`) para cumplir con los estándares de accesibilidad requeridos para lectores de pantalla.
- **Integración global transparente (`src/app/layout.tsx`):** 
  Se inyectó el componente `<AppShell>` como envoltorio principal dentro del layout raíz de Next.js (`layout.tsx`). El trabajo se coordinó cuidadosamente para no sobrescribir ni entrar en conflicto con la configuración del `viewport` y los metadatos PWA (`manifest.webmanifest`) previamente configurados por el Bloque A (Danna).

**Etapa 2 — Sistema de Diseño y Estilos Nativos**
- **Ampliación de variables CSS (`src/app/globals.css`):** 
  Se amplió el sistema de diseño basado en variables CSS (`--accent`, `--surface`, `--text-main`, `--line`, etc.) para dar soporte a los nuevos componentes.
- **Estilización sin dependencias (Vanilla CSS):** 
  Cumpliendo estrictamente con la restricción de "cero dependencias innecesarias", todo el diseño visual fue construido usando Vanilla CSS en lugar de frameworks externos. Se garantizaron prácticas modernas como el uso de `flexbox` para el posicionamiento, sombras suaves para la jerarquía visual y transiciones para interacciones.
- **Diseño Responsive y Accesibilidad Visual:** 
  Se incluyeron _media queries_ para adaptar la navegación a dispositivos móviles (`<=760px`), permitiendo que el diseño se ajuste fluidamente en pantallas pequeñas. Además, se definieron estilos explícitos para `:focus-visible` en todos los elementos interactivos, asegurando la navegabilidad por teclado.

**Etapa 3 — Estados de Interfaz de Usuario (UI States)**
- **Manejo de Carga (`loading-state.tsx` y `src/app/loading.tsx`):** 
  Se creó un componente reutilizable de carga (`LoadingState`) con un spinner animado por CSS. Este componente fue integrado nativamente con Next.js App Router mediante `loading.tsx`, permitiendo que las transiciones entre páginas muestren retroalimentación inmediata, mejorando la percepción de rendimiento. Se incluyeron atributos `aria-live="polite"` y `aria-busy="true"`.
- **Manejo de Errores (`error-state.tsx` y `src/app/error.tsx`):** 
  Se implementó un componente `ErrorState` que presenta una tarjeta amigable cuando algo falla. Este fue envuelto en un _Error Boundary_ global de Next.js (`error.tsx`), interceptando fallos en tiempo de ejecución. Incluye un botón para que el usuario pueda reintentar la acción (`reset()`).
- **Estado Vacío (`empty-state.tsx`):** 
  Se desarrolló un componente ilustrativo para representar estados donde no hay datos (p. ej., lista de inspecciones vacía), proporcionando un mensaje claro al usuario en lugar de una pantalla en blanco.

**Etapa 4 — Ruta determinista para QA**
- **Página de Prueba de Error (`src/app/test-error/page.tsx`):** 
  Para apoyar al Bloque C (Tonanzin) en las pruebas automatizadas (Vitest) y verificación del _Error Boundary_, desarrollé una ruta específica de QA (`/test-error`). Esta página expone un botón que lanza una excepción deliberada en tiempo de render, ofreciendo una forma determinista y controlada de reproducir errores sin depender de fallos intermitentes de red o servidor.

### 3. Decisiones técnicas

- **Vanilla CSS sobre frameworks externos:** Para cumplir estrictamente con el alcance de Semana 2 ("No agregar dependencias innecesarias"), descarté Tailwind CSS y utilicé CSS nativo basado en las variables personalizadas del starter.
- **Semántica web y accesibilidad:**
  - Uso de landmarks HTML5 y ARIA: `<header role="banner">`, `<nav aria-label="Navegación principal">`, `<div role="main">`, `<footer role="contentinfo">`.
  - Distinción estricta entre `Link` de `next/link` (para navegación entre rutas) y `<button>` (para acciones interactivas como reintentar o lanzar error).
  - Estilos de `:focus-visible` para garantizar que la navegación por teclado sea clara y visible.
- **Reproducibilidad determinista de errores:** En lugar de simular fallos aleatorios, la ruta `/test-error` usa un estado reactivo que lanza una excepción al pulsar el botón, lo que permite pruebas automatizadas confiables en CI.
- **Separación de responsabilidades:** No invadí la creación de rutas ni el manifest (Bloque A de Danna) ni la configuración de Vitest/CI (Bloque C de Tonanzin).

### 4. Pruebas / verificaciones realizadas

- `npm test` → `starter.spec.mjs: PASS`.
- `npm run build` → Next.js 14.2.35 compiló exitosamente generando todas las páginas estáticas: `/`, `/_not-found`, `/inspections`, `/maintenance`, `/test-error`.
- `npm run verify` → `Verificación técnica: pass`. Se generó correctamente `reports/verification.json`.
- Validación manual en navegador en `http://localhost:3000`:
  - Navegación fluida entre `/`, `/inspections` y `/maintenance` dentro del `AppShell`.
  - En `/test-error`, ejecución del botón para confirmar la captura de error por el `ErrorBoundary`.
  - Comprobación del responsive y del indicador visual de foco con la tecla `Tab`.

### 5. Limitaciones / alcance

- Los estados de datos (Empty / Success) actualmente se representan con datos sintéticos locales; no se conectó ninguna API ni base de datos real.
- Las pruebas automatizadas en Vitest y la configuración de GitHub Actions corresponden al Bloque C de Tonanzin.

### 6. Uso de IA

Se utilizó Antigravity IDE (Gemini / Claude) como asistente de desarrollo para:
- Analizar los requerimientos del Bloque B y la estructura de componentes recomendada para Next.js App Router.
- Diseñar la estructura semántica accesible de `app-shell.tsx` y los componentes de UI.
- Generar las clases CSS nativas armonizadas con `globals.css`.
- Integrar la rama `main` tras el merge del PR de Danna sin conflictos.

Todas las decisiones de diseño, accesibilidad, rutas y verificación fueron revisadas, probadas y validadas directamente por el integrante.

### 7. Commits de Semana 2

- `20f81e8` — `feat(ui): implement AppShell, UI states, and accessible navigation`
- Commit de integración con `main` y evidencia individual.

---

# Evidencia individual — Semana 3

> Solo se documenta lo que cada integrante hizo, probó o decidió. Danna y Fernando agregan aquí su propia sección de Semana 3. El kit pide: commit SHA evaluado, decisión técnica que se puede explicar, prueba ejecutada con su resultado, limitación o fallo diagnosticado, cambio que se podría defender o modificar en vivo, y uso declarado de IA.

## Integrante: Tonanzin

### 1. Rol / bloque individual

Documentación, evidencia e integración: `README.md`, `evidence/individual.md`, revisión de los criterios del kit de la Semana 3, checklist de integración final, limpieza del repositorio y participación en la revisión final.

### 2. Trabajo realizado

- `README.md`: instalación, ejecución, verificación, manifest, Service Worker, offline y cachés, pruebas ejecutadas, decisiones, supuestos, limitaciones y evidencia de la entrega.
- `evidence/individual.md`: resolución del conflicto de merge que seguía en `main` (quedaban un `=======` y un `>>>>>>>` con el archivo duplicado), conservando la evidencia de Semana 1 y las secciones de Semana 2 de Danna, Tonanzin y Fernando.
- `docs/integration-checklist.md`: checklist de integración final, hallazgos de la revisión y trazabilidad de cada requisito del kit de la Semana 3 contra su artefacto y su evidencia.
- `package.json`: se eliminó la clave `"test:manifest"` sobrante fuera de `scripts`; `npm test` ahora ejecuta también Vitest; se declara Node con `engines`. `.nvmrc` nuevo (`20.19.6`).
- Se incorporó el workflow del kit `.github/workflows/week-03-w03-service-worker-offline.yml` y el `public-tests/check.sh` de la Semana 3.
- [COMPLETAR: otra cosa que hiciste tú]

### 3. Decisiones técnicas

- `npm test` ejecuta la prueba del starter y después Vitest, porque el workflow del kit invoca `npm run test -- --run`; con el script anterior las pruebas nuevas de Vitest no se habrían ejecutado en ese paso.
- Node declarado con `engines` (`>=20.19.0`) y `.nvmrc` (`20.19.6`, la versión del CI), porque el kit exige configuración de Node declarada.
- No copié `ASSIGNMENT.md` al repositorio: es material del kit, no del producto, y su texto contiene palabras que el escaneo de `check.sh` marcaría.
- No apliqué `npm audit fix --force` ante las vulnerabilidades reportadas, para no romper la compatibilidad del proyecto (misma decisión que en la Semana 1).
- [COMPLETAR: otra decisión tuya y por qué]

### 4. Pruebas / verificaciones realizadas

| Comando | Entorno | Resultado real |
|---|---|---|
| `npm ci` | Windows, PowerShell; npm 10.8.2; Node [COMPLETAR: salida de `node -v`] | Instaló 197 paquetes (198 auditados). npm reportó 6 vulnerabilidades (3 moderadas, 2 altas, 1 crítica). |
| `npm run test -- --run` | Igual | `starter.spec.mjs: PASS`; Vitest v3.2.7: 3 archivos y 19 pruebas en verde. Los mensajes «Error capturado por ErrorState» en stderr vienen de pruebas que fuerzan un error a propósito. |
| `npm run verify` | Igual | «Verificación técnica: pass. Revisión académica: pendiente.» Ejecutó la suite (19/19) y `next build` (compiló y generó `/`, `/_not-found`, `/inspections`, `/maintenance` y `/test-error`); reporte en `reports/verification.json`. |
| `bash public-tests/check.sh` | PowerShell | `bash` no se reconoce en PowerShell. [COMPLETAR: resultado al ejecutarlo en Git Bash con `rg` instalado] |
| `git grep` de marcadores de conflicto | PowerShell | [COMPLETAR: resultado de `git grep -nE '^(<<<<<<<\|>>>>>>>)'` y de `git grep -nE '^={7}$'`] |

Qué no verifican estas pruebas: no validan la calidad de los documentos ni, por sí solas, el comportamiento offline.

### 5. Limitaciones / alcance

- Al revisar `main` no se encontraron los cinco artefactos del kit (`public/sw.js`, `src/lib/pwa/register-service-worker.ts`, `docs/cache-strategy.md`, `tests/service-worker.spec.ts`, `tests/offline.spec.ts`). Las secciones 7–9 del README describen cómo comprobarlos y dejan campos por completar hasta que existan.
- `public-tests/check.sh` no sirve como aprobado/reprobado: por su uso de `set -e`, `&&` y `!` imprime `PUBLIC_OK` aunque falten artefactos (lo comprobé ejecutándolo sin `public/sw.js`). La comprobación real de artefactos es el paso AC-02 del CI. [COMPLETAR: salida real en Git Bash y respuesta del docente]
- `npm ci` reporta 6 vulnerabilidades, una de ellas crítica. [COMPLETAR: paquetes afectados según `npm audit` y si son dependencias de desarrollo]
- [COMPLETAR: otra limitación que encontraste]

### 6. Cambio que podría defender o modificar en vivo

[COMPLETAR: un cambio tuyo que puedas explicar y modificar en vivo. La opción más natural es el script `test` de `package.json`: qué hacía antes, qué hace ahora y por qué.]

### 7. Uso de IA

Herramienta: Claude (Anthropic). Propósito: revisar el contenido del repositorio y del kit de la Semana 3, redactar borradores de `README.md` y `docs/integration-checklist.md`, y proponer la resolución del conflicto en `evidence/individual.md` y los cambios en `package.json`. Partes influenciadas: esos archivos y `.nvmrc`. Validación propia: [COMPLETAR: qué revisaste y ejecutaste tú misma].

### 8. Commits de Semana 3

- [COMPLETAR: SHA completo] — docs: README, evidencia, checklist de integracion y workflow del kit de Semana 3
