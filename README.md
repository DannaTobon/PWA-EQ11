# PWA de inspecciones de laboratorio — DMI-EQ11C / PWA-EQ11

Aplicación web progresiva (PWA) para registrar y consultar inspecciones y mantenimiento de laboratorios en un contexto de conectividad intermitente. Es un proyecto acumulativo de curso: un repositorio privado por equipo. Todos los datos son **sintéticos**.

Stack: Next.js 14 (App Router) + React 18 + TypeScript. Pruebas con Vitest + Testing Library.

## 1. Estado actual del proyecto

| Capacidad | Estado |
|---|---|
| Rutas `/`, `/inspections`, `/maintenance` | Implementado |
| Manifest PWA + iconos 192/512 + metadata/viewport | Implementado |
| AppShell (header, navegación, main, footer) y estados de UI (loading, error, empty) | Implementado |
| Pruebas automatizadas (manifest y comportamiento de UI) y CI | Implementado |
| Service Worker, cachés y funcionamiento offline (Semana 3) | **Implementado** (`public/sw.js`, `src/lib/pwa/register-service-worker.ts`, `docs/cache-strategy.md`, `tests/service-worker.spec.ts` y `tests/offline.spec.ts`) |
| Registro de inspecciones, persistencia local, sincronización, API, autenticación | No implementado (Semana 4+) |

## 2. Entorno

Requisitos: Node.js 20.19 o posterior compatible, npm 10 o posterior y Git. No se requiere Make.

**Versiones usadas por el equipo (verificadas localmente):**

- Node.js: v20.x / v22.x
- npm: 10.8+
- Next.js: 14.2.35
- SO: Windows
- CI (GitHub Actions): Node.js 20.19.6 en `ubuntu-latest`
- Node declarado en el repositorio: `engines` en `package.json` (`>=20.19.0`) y `.nvmrc` (`20.19.6`, la versión del CI)

**Dificultades de entorno registradas:** ninguna bloqueante. `npm ci` finaliza con éxito. Se decidió **no** aplicar `npm audit fix --force` para no romper la compatibilidad del proyecto ni las dependencias fijadas.

## 3. Instalación

```bash
npm ci
```

Usar `npm ci` (no `npm install`) para una instalación reproducible a partir de `package-lock.json`.

## 4. Ejecución

Modo desarrollo:

```bash
npm run dev
```

Abrir `http://localhost:3000`. Detener con Ctrl+C.

Modo producción (**recomendado para comprobar PWA, Service Worker y offline**, porque en desarrollo el comportamiento de caché y de registro de Service Worker no representa el de producción):

```bash
npm run build
npm start
```

| Ruta | Contenido |
|---|---|
| `/` | Página de bienvenida con enlaces a las secciones |
| `/inspections` | Listado de las tres inspecciones sintéticas |
| `/maintenance` | Estructura inicial de mantenimiento (sin funcionalidad de registro) |
| `/test-error` | Ruta de QA que lanza un error deliberado para comprobar el `ErrorBoundary` |
| `/offline` | Página de fallback offline cuando no hay conectividad de red |

## 5. Cómo verificar el proyecto

| Comando | Qué hace | Qué **no** verifica |
|---|---|---|
| `npm run verify` (equivalente exacto de `make verify`) | Comprueba archivos requeridos (incluyendo los 5 artefactos de Semana 3), corre `npm test` y `npm run build`; genera `reports/verification.json` | Calidad de los documentos ni sincronización en la nube |
| `npm test` | Ejecuta `tests/starter.spec.mjs` y toda la suite de Vitest (`vitest run`). El CI de la Semana 3 lo invoca como `npm run test -- --run` | Rutas completas, pruebas end-to-end |
| `npm run test:manifest` | Ejecuta la suite de Vitest y escribe `vitest-report.json` | Pruebas end-to-end |
| `npm run build` | Compilación de producción de Next.js, lint y validación de tipos | Comportamiento en ejecución |
| `bash public-tests/check.sh` | Comprueba contrato mínimo de la Semana 3 (cinco artefactos y README) | Pruebas funcionales de lógica de negocio |

Comprobación rápida de artefactos en PowerShell:

```powershell
Test-Path public\sw.js, src\lib\pwa\register-service-worker.ts, docs\cache-strategy.md, tests\service-worker.spec.ts, tests\offline.spec.ts
```

Nota: `test:manifest` corre todas las pruebas de Vitest, no solo las del manifest; el nombre viene de la Semana 2 y el workflow de esa semana lo invoca.

**CI:** workflows que se ejecutan en cada push y pull request:

- `Starter Semana 1 — feedback` (`.github/workflows/week-01-starter-feedback.yml`): `npm ci` + `npm run verify`; sube el artefacto `starter-week-01-evidence`.
- `Semana 2 — tests y build` (`.github/workflows/week-02-feedback.yml`): `npm ci` + `npm run test:manifest` + `npm run build`.
- `Academic Evaluation Feedback` (`.github/workflows/week-03-w03-service-worker-offline.yml`, kit de Semana 3): `npm ci`, build de producción, comprobación de los 5 artefactos (AC-02), suite ejecutable (AC-03) y verificación técnica general.

`reports/verification.json` y `vitest-report.json` no se versionan (están en `.gitignore`): se adjuntan en Classroom o se descargan de Actions para el SHA entregado.

## 6. Cómo comprobar el manifest y los iconos

1. Con el servidor en ejecución, abrir `http://localhost:3000/manifest.webmanifest`: devuelve el JSON (nombre «Inspecciones de laboratorio», `display: standalone`, `start_url` y `scope` `/`, iconos 192×192 y 512×512).
2. En Chrome/Edge: F12 → **Application** → **Manifest**. Revisar nombre, colores, iconos y advertencias.
3. Automático: `npm run test:manifest` (6 pruebas en `tests/manifest.spec.ts`).

## 7. Cómo comprobar el Service Worker

1. Ejecutar `npm run build` y `npm start`; abrir `http://localhost:3000` (localhost cuenta como contexto seguro).
2. F12 → **Application** → **Service Workers**. Debe aparecer un worker con `Status: activated and is running`, con `Scope` `/` registrado desde `public/sw.js`.
3. Recargar la página. En la consola, `navigator.serviceWorker.controller` debe ser distinto de `null` (la página está controlada por el worker).
4. Alternativa por consola: `navigator.serviceWorker.getRegistrations().then(console.log)`.
5. Para repetir la prueba desde cero: en **Application** usar **Unregister** y **Storage → Clear site data**, y recargar.

## 8. Cómo comprobar el comportamiento offline

1. Con el build de producción en marcha (`npm run build && npm start`), visitar **con conexión** las rutas principales (`/`, `/inspections`, `/maintenance`) para que se almacenen en caché.
2. F12 → **Network** → *Throttling* → **Offline** (o **Application → Service Workers → Offline**).
3. Recargar cada ruta y navegar entre ellas con los enlaces del menú. Las rutas cacheadas se sirven inmediatamente desde el Cache Storage.
4. Prueba más realista: detener el servidor (Ctrl+C en la terminal) y recargar la página. Con el Service Worker activo, la aplicación sigue respondiendo y muestra las rutas almacenadas o la página de respaldo `/offline`.
5. Volver a **No throttling** y reanudar el servidor para confirmar que la aplicación vuelve a modo online sin errores.

## 9. Cómo comprobar las cachés

1. F12 → **Application** → **Cache Storage**: lista las cachés versionadas (`pwa-eq11-v1-pages`, `pwa-eq11-v1-static`, `pwa-eq11-v1-core`) y sus entradas.
2. Por consola: `caches.keys().then(console.log)`.
3. En **Network**, las respuestas servidas por el worker se identifican con «(ServiceWorker)» en la columna *Size*.
4. Al publicar una versión nueva del worker, la fase de activación elimina automáticamente las cachés de versiones anteriores de forma atómica.

## 10. Pruebas ejecutadas

Suite automatizada actual: **57 pruebas de Vitest + 1 prueba del starter** (Total: 58 pruebas, 100% pasando).

| Archivo | Pruebas | Qué cubre |
|---|---:|---|
| `tests/starter.spec.mjs` | 1 | Script `build` y textos base de la página principal |
| `tests/manifest.spec.ts` | 6 | Manifest existe, JSON válido, `name`/`short_name`, `display: standalone`, `start_url`/`scope`, iconos 192×192 y 512×512 con archivo real |
| `tests/app-shell.spec.tsx` | 4 | Landmarks (`banner`, `navigation`, `main`, `contentinfo`), contenido dentro de `main`, enlaces de navegación y de marca |
| `tests/ui-states.spec.tsx` | 9 | `LoadingState`, `ErrorState` (incluye `reset()` al reintentar) y `EmptyState` |
| `tests/service-worker.spec.ts` | 8 | Ciclo de vida del Service Worker (install, activate, precache, fetch handling) |
| `tests/offline.spec.ts` | 17 | Experiencia offline, navegación fallback y manejo de caché estática y dinámica |
| `tests/register-service-worker.spec.ts` | 13 | Contrato y comportamiento del cliente de registro del Service Worker |

Resultado observado en local y CI: `npm test` y `npm run verify` completan con «Verificación técnica: pass», con el build generando `/`, `/_not-found`, `/inspections`, `/maintenance`, `/offline` y `/test-error`.

## 11. Decisiones técnicas relevantes

- **PWA como estrategia de aplicación** (ADR-001 en `docs/decision-record.md`): un solo código base web, distribución por URL y base para operación offline.
- **Next.js App Router** con rutas reales y navegación con `next/link`.
- **Manifest** en `public/manifest.webmanifest`, enlazado con la API `metadata` de Next.js.
- **Service Worker nativo en `public/sw.js`** sin librerías externas para máximo control y transparencia de caché.
- **Estrategia Network-First para páginas HTML** y **Cache-First para assets estáticos** inmutables.
- **Componente cliente `<ServiceWorkerRegister />`** aislado, manteniendo `layout.tsx` como Server Component.
- **Vitest en entorno `jsdom`** con plugin de React y versiones compatibles con Node 20.
- **`npm test` unificado** (`node tests/starter.spec.mjs && vitest run`) para compatibilidad directa con el runner del CI.

## 12. Supuestos

- Todos los datos son sintéticos; no hay datos personales reales ni credenciales en el repositorio.
- El alcance de la Semana 3 es la consulta offline de la interfaz y de los datos sintéticos ya cacheados. El registro offline y la sincronización (RF-02 a RF-04) quedan para semanas posteriores.
- Las comprobaciones manuales de Service Worker, offline y cachés se realizan sobre el build de producción en `localhost` (contexto seguro).
- `make verify` no es obligatorio; su equivalente exacto es `npm run verify`.

## 13. Limitaciones

- No hay persistencia de modificaciones realizadas offline ni sincronización en segundo plano (Background Sync).
- Las dependencias del starter original reportan vulnerabilidades heredadas que no se alteraron para conservar estabilidad.
- No hay autenticación de usuarios ni bases de datos remotas conectadas.

## 14. Evidencia de la entrega

- `evidence/individual.md`: una sección por integrante y por semana, con commits, decisiones, pruebas, limitaciones y uso declarado de IA.
- `docs/requirements.md` y `docs/decision-record.md`: requisitos y decisión del equipo.
- `docs/cache-strategy.md`: documentación completa de la estrategia de almacenamiento y ciclo de vida de cachés.
- `docs/integration-checklist.md`: checklist de integración y trazabilidad del kit de Semana 3.
- Artefactos de GitHub Actions del SHA entregado: `academic-evidence-w03-service-worker-offline`.
- SHA final: se obtiene después del último commit con `git rev-parse HEAD`.

## 15. Estructura y flujo de trabajo

```text
src/app/            rutas (/, /inspections, /maintenance, /offline, /test-error), layout
src/components/     AppShell, componentes de estado (ui/) y registro SW
src/lib/data/       datos sintéticos
src/lib/pwa/        registro del Service Worker (register-service-worker.ts)
public/             manifest, iconos, sw.js y offline.html
tests/              pruebas Vitest (manifest, UI, service worker, offline) y starter
scripts/            verify.mjs
docs/               requisitos, decisión (ADR-001), cache-strategy.md y checklist de integración
evidence/           evidencia individual (individual.md)
.github/workflows/  CI (Semana 1, Semana 2 y Semana 3)
```
