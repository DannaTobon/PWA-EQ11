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
| CSR/SSR con estados verificables (Semana 4): `/inspecciones` (cliente) y `/inspecciones/[id]` (servidor dinámico) | **Implementado** (`src/app/inspecciones/page.tsx`, `src/app/inspecciones/[id]/page.tsx`, `src/app/api/inspecciones/route.ts`, `tests/rendering.spec.tsx`, `docs/rendering-decision.md`) |
| Persistencia local (IndexedDB), cola de sincronización idempotente y conflictos con revisión manual (Semana 5) | **Implementado** (`src/lib/storage/`, `src/lib/sync/`, integración en `/inspecciones`, `docs/sync-policy.md`, `tests/sync.spec.ts`, `tests/sync-ui.spec.tsx`) |
| Autenticación | No implementado (semanas posteriores) |

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
| `/inspections` | Listado de las tres inspecciones sintéticas (ruta previa, se conserva por decisión del equipo) |
| `/inspecciones` | Listado **CSR**: componente cliente que consulta `/api/inspecciones` y muestra carga, error, reintento y lista. Forzar el fallo determinista con `/inspecciones?fallar=1` |
| `/inspecciones/[id]` | Detalle **SSR dinámico** (`force-dynamic`) de una inspección por `id`, p. ej. `/inspecciones/inspection-001`. Un `id` inexistente muestra la vista de "no encontrada" |
| `/maintenance` | Estructura inicial de mantenimiento (sin funcionalidad de registro) |
| `/test-error` | Ruta de QA que lanza un error deliberado para comprobar el `ErrorBoundary` |
| `/offline` | Página de fallback offline cuando no hay conectividad de red |

## 5. Cómo verificar el proyecto

| Comando | Qué hace | Qué **no** verifica |
|---|---|---|
| `npm run verify` (equivalente exacto de `make verify`) | Comprueba todos los archivos requeridos hasta Semana 5, corre la suite, genera `vitest-report.json`, ejecuta el build y genera `reports/verification.json` | Calidad académica de los documentos, servicios remotos reales ni pruebas end-to-end |
| `npm test` | Ejecuta `tests/starter.spec.mjs` y toda la suite de Vitest (`vitest run`), incluidas persistencia, cola, conflictos e integración de la UI | Servicios externos o varias instancias del servidor |
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
- `Academic Evaluation Feedback` (`.github/workflows/week-05-w05-sync-data.yml`, kit de Semana 5): instalación limpia, comprobación de entregables, `npm run verify` y publicación de `reports/verification.json` y `vitest-report.json`.

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

Suite automatizada actual: **104 pruebas de Vitest + 1 prueba del starter** (total: 105 pruebas).

| Archivo | Pruebas | Qué cubre |
|---|---:|---|
| `tests/starter.spec.mjs` | 1 | Script `build` y textos base de la página principal |
| `tests/manifest.spec.ts` | 6 | Manifest existe, JSON válido, `name`/`short_name`, `display: standalone`, `start_url`/`scope`, iconos 192×192 y 512×512 con archivo real |
| `tests/app-shell.spec.tsx` | 4 | Landmarks (`banner`, `navigation`, `main`, `contentinfo`), contenido dentro de `main`, enlaces de navegación y de marca |
| `tests/ui-states.spec.tsx` | 9 | `LoadingState`, `ErrorState` (incluye `reset()` al reintentar) y `EmptyState` |
| `tests/service-worker.spec.ts` | 8 | Ciclo de vida del Service Worker (install, activate, precache, fetch handling) |
| `tests/offline.spec.ts` | 17 | Experiencia offline, navegación fallback y manejo de caché estática y dinámica |
| `tests/register-service-worker.spec.ts` | 13 | Contrato y comportamiento del cliente de registro del Service Worker |
| `tests/rendering.spec.tsx` | 5 | CSR (`/inspecciones`): carga→lista, error ante fallo controlado y reintento; SSR (`/inspecciones/[id]`): detalle válido e invocación de `notFound()` ante un id inexistente |
| `tests/storage.spec.ts` | 8 | Persistencia IndexedDB, reapertura, outbox y transacción conjunta |
| `tests/queue.spec.ts` | 10 | Reintentos, idempotencia, clasificación HTTP y recuperación de operaciones interrumpidas |
| `tests/sync.spec.ts` | 15 | Conflictos, ambas versiones, orden, recuperación y continuidad de otras inspecciones |
| `tests/sync-ui.spec.tsx` | 8 | Inicio, evento `online`, desmontaje, exclusión mutua, reintento manual y UI de revisión |

El resultado exacto de la verificación final se actualiza después de ejecutar la cadena reproducible de la sección de Semana 5. `npm run verify` valida estructura, suite completa y build, y deja ambos reportes ignorados por Git.

## 11. Decisiones técnicas relevantes

- **PWA como estrategia de aplicación** (ADR-001 en `docs/decision-record.md`): un solo código base web, distribución por URL y base para operación offline.
- **Next.js App Router** con rutas reales y navegación con `next/link`.
- **Manifest** en `public/manifest.webmanifest`, enlazado con la API `metadata` de Next.js.
- **Service Worker nativo en `public/sw.js`** sin librerías externas para máximo control y transparencia de caché.
- **Estrategia Network-First para páginas HTML** y **Cache-First para assets estáticos** inmutables.
- **Componente cliente `<ServiceWorkerRegister />`** aislado, manteniendo `layout.tsx` como Server Component.
- **Vitest en entorno `jsdom`** con plugin de React y versiones compatibles con Node 20.
- **`npm test` unificado** (`node tests/starter.spec.mjs && vitest run`) para compatibilidad directa con el runner del CI.
- **Contraste CSR/SSR de la Semana 4** (`docs/rendering-decision.md`): `/inspecciones` como componente cliente (`"use client"`) que reutiliza `LoadingState`/`ErrorState` ya existentes, con un endpoint interno (`/api/inspecciones`) que puede fallar de forma determinista (`?fallar=1`); `/inspecciones/[id]` como Server Component con `export const dynamic = "force-dynamic"` para renderizarse por solicitud, resolviendo un id inexistente con `notFound()`.
- **Pruebas nuevas en `tests/rendering.spec.tsx`** (no `.spec.ts`): la extensión `.tsx` es necesaria para que Vitest/esbuild compile el JSX usado al renderizar las páginas en las pruebas.

## 12. Supuestos

- Todos los datos son sintéticos; no hay datos personales reales ni credenciales en el repositorio.
- La captura de Semana 5 se guarda en IndexedDB y su operación queda en una cola persistente hasta que pueda sincronizarse.
- Las comprobaciones manuales de Service Worker, offline y cachés se realizan sobre el build de producción en `localhost` (contexto seguro).
- `make verify` no es obligatorio; su equivalente exacto es `npm run verify`.
- El retardo de 800 ms del endpoint `/api/inspecciones` es una métrica de desarrollo para observar los estados de carga; no mide latencia real de red ni de producción.
- La ruta `/inspections` (en inglés) se mantiene sin cambios; el equipo decidió no migrarla en esta entrega.

## 13. Limitaciones

- No hay Background Sync: la pantalla debe estar abierta para procesar la cola al iniciar, al recibir `online` o mediante el botón manual.
- Las dependencias del starter original reportan vulnerabilidades heredadas que no se alteraron para conservar estabilidad.
- No hay autenticación de usuarios ni bases de datos remotas conectadas.
- La navegación (`AppShell`) y el precache del Service Worker no se actualizaron para incluir `/inspecciones`: el listado depende de un fetch que puede fallar deliberadamente y el detalle es dinámico por solicitud, por lo que precachearlos como contenido estático contradiría lo que la actividad de Semana 4 pide demostrar (ver `docs/rendering-decision.md`, sección 5).
- La prueba de `notFound()` en `tests/rendering.spec.tsx` verifica que la función se invoca, pero no reproduce el pipeline completo de Next.js que sustituye la salida por `not-found.tsx`; esa parte se validó manualmente con el build de producción.

## 13b. Sincronización y conflictos (Semana 5)

Política de revisión manual por inspección: un conflicto conserva la versión local y la remota, detiene los reintentos de esa operación, bloquea las siguientes de la misma inspección y deja continuar las demás. Se resuelve con `keepLocal` (nueva operación con nuevo `operationId` sobre la revisión vigente) o `acceptServer` (sin enviar otra mutación). Detalle, límites y riesgos en `docs/sync-policy.md`.

La ruta `/inspecciones` procesa la cola al montarse y al recibir el evento `online`, elimina el listener al desmontarse y evita ejecuciones simultáneas. Presenta estados pendiente, sincronizando, sincronizada, fallida y conflicto; ofrece sincronización y reintento manual, y muestra ambas versiones para resolver conflictos.

```bash
npx vitest run tests/sync.spec.ts   # pruebas de conflictos
npm ci && npm test && npm run build && npm run verify
```

`make verify` equivale a `npm run verify` (en Windows se usa este último). La API sintética es en memoria y pierde su estado al reiniciar; no hay Background Sync.

### Prueba manual y reproducible de Semana 5

1. Ejecutar `npm ci --no-audit --no-fund`, `npm run build` y `npm start`; abrir `/inspecciones`.
2. En DevTools → Network, activar **Offline**, guardar una inspección y recargar: debe conservarse en IndexedDB con estado **Pendiente**.
3. Volver a **Online**: el evento `online` procesa la cola. También puede usarse **Sincronizar ahora**.
4. Para observar **Fallida**, mantener la red desconectada hasta agotar los reintentos; al reconectar, pulsar **Reintentar sincronización**. El mismo `operationId` se reutiliza.
5. Comprobar duplicados e idempotencia con `npx vitest run tests/queue.spec.ts`.
6. Comprobar un conflicto 409, conservación de ambas versiones, bloqueo por inspección y ambas resoluciones con `npx vitest run tests/sync.spec.ts`.
7. Comprobar inicio, reconexión, listener, exclusión mutua y controles de revisión con `npx vitest run tests/sync-ui.spec.tsx`.

Limitaciones confirmadas: la API es sintética y guarda datos e idempotency keys solo en memoria; al reiniciar o usar varias instancias la idempotencia no es durable. No existe Background Sync ni una base remota real. Los envíos son seriales y el backoff de una operación retrasa temporalmente las demás. La resolución de un conflicto usa varias escrituras IndexedDB secuenciales, no una única transacción atómica.

## 14. Evidencia de la entrega

- `evidence/individual.md`: una sección por integrante y por semana, con commits, decisiones, pruebas, limitaciones y uso declarado de IA.
- `docs/requirements.md` y `docs/decision-record.md`: requisitos y decisión del equipo.
- `docs/cache-strategy.md`: documentación completa de la estrategia de almacenamiento y ciclo de vida de cachés.
- `docs/integration-checklist.md`: checklist de integración y trazabilidad del kit de Semana 3.
- `docs/rendering-decision.md`: decisión técnica, supuestos, métrica, límites y fallos encontrados de la Semana 4 (CSR/SSR).
- Artefactos de GitHub Actions del SHA entregado: `academic-evidence-w03-service-worker-offline`.
- SHA final: se obtiene después del último commit con `git rev-parse HEAD`.

## 15. Estructura y flujo de trabajo

```text
src/app/            rutas (/, /inspecciones, /inspecciones/[id], /inspections, /maintenance, /offline, /test-error), layout
src/app/api/        endpoint interno (/api/inspecciones) con fallo determinista (?fallar=1)
src/components/     AppShell, componentes de estado (ui/) y registro SW
src/lib/data/       datos sintéticos
src/lib/pwa/        registro del Service Worker (register-service-worker.ts)
src/lib/storage/    esquema y adaptador IndexedDB
src/lib/sync/       cliente, cola, política de conflictos e integración con la UI
public/             manifest, iconos, sw.js y offline.html
tests/              pruebas Vitest (manifest, UI, service worker, offline, rendering CSR/SSR) y starter
scripts/            verify.mjs
docs/               requisitos, decisión (ADR-001), cache-strategy.md, rendering-decision.md y checklist de integración
evidence/           evidencia individual (individual.md)
.github/workflows/  CI (Semana 1, Semana 2 y Semana 3)
```
