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
| Service Worker, cachés y funcionamiento offline (Semana 3) | **No existe en este snapshot de `main`.** El kit exige `public/sw.js`, `src/lib/pwa/register-service-worker.ts`, `docs/cache-strategy.md`, `tests/service-worker.spec.ts` y `tests/offline.spec.ts`; ninguno existe todavía (ver secciones 7–9) |
| Registro de inspecciones, persistencia local, sincronización, API, autenticación | No implementado |

> Al preparar esta versión del README se revisó `main`: no hay archivo de Service Worker en `public/` ni registro en `src/`, y `GET /sw.js` responde 404 con el build de producción. Las secciones 7–9 explican **cómo comprobarlo**; hasta que se fusione el trabajo de Service Worker, el resultado esperado es «sin Service Worker». Actualizar los campos marcados `[COMPLETAR]` cuando esa parte se integre.

## 2. Entorno

Requisitos: Node.js 20.19 o posterior compatible, npm 10 o posterior y Git. No se requiere Make.

**Versiones usadas por el equipo (verificadas localmente):**

- Node.js: v22.22.0
- npm: 10.9.4
- Next.js: 14.2.35
- SO: Windows
- CI (GitHub Actions): Node.js 20.19.6 en `ubuntu-latest`
- Node declarado en el repositorio: `engines` en `package.json` (`>=20.19.0`) y `.nvmrc` (`20.19.6`, la versión del CI)

**Dificultades de entorno registradas:** ninguna bloqueante. `npm ci` finalizó con éxito en la primera ejecución. En la primera entrega solo se detectaron vulnerabilidades heredadas del starter (2 de severidad alta según `npm audit`). Tras agregar las dependencias de pruebas, `npm ci` en Windows (npm 10.8.2) reporta 6 vulnerabilidades (3 moderadas, 2 altas y 1 crítica); `[COMPLETAR: paquetes afectados según npm audit y si vienen de dependencias de desarrollo]`. Se decidió **no** aplicar `npm audit fix --force` para no romper la compatibilidad del proyecto.

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

## 5. Cómo verificar el proyecto

| Comando | Qué hace | Qué **no** verifica |
|---|---|---|
| `npm run verify` (equivalente exacto de `make verify`) | Comprueba archivos requeridos, corre `npm test` y `npm run build`; genera `reports/verification.json` | Calidad de los documentos, ausencia de credenciales expuestas, instalación (`npm ci` va aparte) ni comportamiento offline por sí mismo |
| `npm test` | Ejecuta `tests/starter.spec.mjs` (script `build` = `next build`; la página principal contiene «Inspecciones de laboratorio» y «sintéticos») y después toda la suite de Vitest. El CI de la Semana 3 lo invoca como `npm run test -- --run` | Rutas completas, pruebas end-to-end |
| `npm run test:manifest` | Ejecuta **toda** la suite de Vitest (`tests/**/*.spec.ts(x)`) y escribe `vitest-report.json` | Lo mismo que `npm test` para Vitest; solo cambia el reporte JSON |
| `npm run build` | Compilación de producción de Next.js, lint y validación de tipos | Comportamiento en ejecución |
| `bash public-tests/check.sh` | Intenta comprobar el contrato mínimo de la Semana 3 (cinco artefactos, `README.md` y un escaneo de palabras clave). Requiere Bash (Git Bash o WSL en Windows) y `ripgrep` (`rg`) | **No sirve como aprobado/reprobado**: imprime `PUBLIC_OK` aunque falten artefactos (ver la advertencia siguiente) |
| `node scripts/verify.mjs --structure` | Solo comprueba la estructura de archivos del starter (Semana 1) | Todo lo demás |

Advertencia sobre `public-tests/check.sh`: con `set -e`, una cadena `&&` que falla antes de su último comando no detiene el script, y una línea negada con `!` tampoco. Por eso el script imprime `PUBLIC_OK` (código de salida 0) aunque falten los cinco artefactos o aunque el escaneo de palabras clave encuentre coincidencias; solo falla si falta `README.md`. Se comprobó ejecutándolo en un repositorio sin `public/sw.js`. La comprobación confiable de los artefactos es el paso «AC-02» del workflow de la Semana 3 (que sí falla si falta alguno) o, en local, este comando de PowerShell, que debe devolver cinco `True`:

```powershell
Test-Path public\sw.js, src\lib\pwa\register-service-worker.ts, docs\cache-strategy.md, tests\service-worker.spec.ts, tests\offline.spec.ts
```

El escaneo, cuando hay coincidencias inocuas (nombres de dependencias en `package-lock.json`, palabras comunes de la documentación en español), las imprime sin detener el script. `[COMPLETAR: salida real de check.sh en Git Bash y respuesta del docente]`. En los documentos nuevos del equipo se evita escribir esas palabras.

Nota: `test:manifest` corre todas las pruebas de Vitest, no solo las del manifest; el nombre viene de la Semana 2 y el workflow de esa semana lo invoca.

**CI:** tres workflows se ejecutan en cada push y pull request.

- `Starter Semana 1 — feedback` (`.github/workflows/week-01-starter-feedback.yml`): `npm ci` + `npm run verify`; sube el artefacto `starter-week-01-evidence` (`reports/verification.json`).
- `Semana 2 — tests y build` (`.github/workflows/week-02-feedback.yml`): `npm ci` + `npm run test:manifest` + `npm run build`; sube el artefacto `pwa-eq11-week-02-vitest-report` (`vitest-report.json`).
- `Academic Evaluation Feedback` (`.github/workflows/week-03-w03-service-worker-offline.yml`, del kit de la Semana 3): `npm ci --ignore-scripts`, `npm run build`, comprueba que existan los cinco artefactos y ejecuta `npm run test -- --run`; sube el artefacto `academic-evidence-w03-service-worker-offline`, que solo contiene archivos si existen `evaluation-result.json`, `coverage/` o `test-results/`. `[COMPLETAR: qué genera el equipo para ese artefacto]`.

`reports/verification.json` y `vitest-report.json` no se versionan (están en `.gitignore`): se adjuntan en Classroom o se descargan de Actions para el SHA entregado.

## 6. Cómo comprobar el manifest y los iconos

1. Con el servidor en ejecución, abrir `http://localhost:3000/manifest.webmanifest`: debe devolver el JSON (nombre «Inspecciones de laboratorio», `display: standalone`, `start_url` y `scope` `/`, iconos 192×192 y 512×512).
2. En Chrome/Edge: F12 → **Application** → **Manifest**. Revisar nombre, colores, iconos y las advertencias que muestre el panel.
3. Automático: `npm run test:manifest` (6 pruebas en `tests/manifest.spec.ts`).

## 7. Cómo comprobar el Service Worker

> **Estado:** sin Service Worker en `main` (ver sección 1). Archivo del Service Worker (ruta exigida por el kit): `public/sw.js`. Registro (ruta exigida): `src/lib/pwa/register-service-worker.ts`. Ambos `[pendientes de crear]`; confirmar aquí desde qué componente se invoca el registro: `[COMPLETAR]`.

1. `npm run build` y `npm start`; abrir `http://localhost:3000` (localhost cuenta como contexto seguro).
2. F12 → **Application** → **Service Workers**. Debe aparecer un worker con `Status: activated and is running`, con `Scope` `/` y el archivo esperado.
3. Recargar la página. En la consola, `navigator.serviceWorker.controller` debe ser distinto de `null` (la página está controlada por el worker).
4. Alternativa por consola: `navigator.serviceWorker.getRegistrations().then(console.log)`.
5. Para repetir la prueba desde cero: en **Application** usar **Unregister** y **Storage → Clear site data**, y recargar.

## 8. Cómo comprobar el comportamiento offline

> **Estado:** no implementado en `main`. La estrategia de caché se documentará en `docs/cache-strategy.md` `[pendiente de crear]`. Rutas que deben funcionar sin conexión: `[COMPLETAR, p. ej. /, /inspections, /maintenance]`.

1. Con el build de producción en marcha, visitar **con conexión** cada ruta que deba funcionar offline (para que se cachee).
2. F12 → **Network** → *Throttling* → **Offline** (o **Application → Service Workers → Offline**).
3. Recargar cada ruta y navegar entre ellas con los enlaces del menú. Resultado esperado: `[COMPLETAR]`.
4. Prueba más realista: detener el servidor (Ctrl+C) y recargar. Con Service Worker y caché correctos la aplicación debe seguir mostrando las rutas cacheadas; sin ellos, el navegador muestra su página de error.
5. Volver a **No throttling** y confirmar que la aplicación se recupera.

Recordatorio: el registro de inspecciones offline y su sincronización posterior son requisitos futuros (RF-02 a RF-04 y RNF-05 en `docs/requirements.md`); poder cargar la interfaz sin conexión no equivale a esa capacidad.

## 9. Cómo comprobar las cachés

> **Estado:** sin cachés en `main`. Nombre(s) de caché y política de invalidación: `[COMPLETAR, según docs/cache-strategy.md]`.

1. F12 → **Application** → **Cache Storage**: debe listar la(s) caché(s) del Service Worker y sus entradas (URLs).
2. Por consola: `caches.keys().then(console.log)`.
3. En **Network**, las respuestas servidas por el worker se identifican con «(ServiceWorker)» en la columna *Size*.
4. Al publicar una versión nueva, comprobar que la caché anterior se elimina o se versiona según la estrategia acordada: `[COMPLETAR]`.

## 10. Pruebas ejecutadas

Suite automatizada actual: **19 pruebas de Vitest + 1 prueba del starter**. El kit de la Semana 3 exige además `tests/service-worker.spec.ts` y `tests/offline.spec.ts`, que todavía no existen.

| Archivo | Pruebas | Qué cubre |
|---|---:|---|
| `tests/starter.spec.mjs` | 1 | Script `build` y textos base de la página principal |
| `tests/manifest.spec.ts` | 6 | Manifest existe, JSON válido, `name`/`short_name`, `display: standalone`, `start_url`/`scope`, iconos 192×192 y 512×512 con archivo real |
| `tests/app-shell.spec.tsx` | 4 | Landmarks (`banner`, `navigation`, `main`, `contentinfo`), contenido dentro de `main`, enlaces de navegación y de marca |
| `tests/ui-states.spec.tsx` | 9 | `LoadingState`, `ErrorState` (incluye `reset()` al reintentar) y `EmptyState` |

Resultado observado en Windows (npm 10.8.2, Node `[COMPLETAR: salida de node -v]`, Vitest v3.2.7) sobre la rama con estos cambios: `npm ci` correcto; `npm run test -- --run` → `starter.spec.mjs: PASS` y 3 archivos de Vitest con 19/19 pruebas en verde; `npm run verify` → «Verificación técnica: pass», con el build generando `/`, `/_not-found`, `/inspections`, `/maintenance` y `/test-error`. Los mensajes «Error capturado por ErrorState: Error: fallo de prueba» en la salida provienen de las pruebas de `ErrorState`, que fuerzan un error a propósito; no son fallos. Cada integrante registra sus propias ejecuciones (comando, resultado, entorno) en `evidence/individual.md`.

Pruebas manuales pendientes de registrar cuando exista el Service Worker: instalación desde el navegador, secciones 7–9 de este README.

## 11. Decisiones técnicas relevantes

- **PWA como estrategia de aplicación** (ADR-001 en `docs/decision-record.md`): un solo código base web, distribución por URL y base para operación offline futura. Estado del ADR: `[COMPLETAR: aceptado/fecha]`.
- **Next.js App Router** con rutas reales y navegación con `next/link`.
- **Manifest** en `public/manifest.webmanifest`, enlazado con la API `metadata` de Next.js; viewport y `themeColor` con el export `viewport`.
- **Iconos PNG locales** (192×192 y 512×512), sin recursos externos ni dependencias nuevas.
- **Datos sintéticos** en `src/lib/data/inspections.ts`, reutilizados sin duplicarse.
- **Vanilla CSS** con variables personalizadas, sin frameworks de estilos.
- **Vitest en entorno `jsdom`** con plugin de React, porque `tsconfig.json` usa `jsx: "preserve"`. Se fijaron `vitest@^3.2.4`, `jsdom@^25` y `@testing-library/jest-dom@^6` porque las versiones más nuevas exigen Node ≥ 22 y el CI usa Node 20.
- **Script `test:manifest` separado de `test`**, para no alterar la prueba del starter ni `npm run verify`.
- **Ruta `/test-error`** para reproducir un error de forma determinista y comprobar el `ErrorBoundary`.
- **`npm test` ejecuta también Vitest** (`node tests/starter.spec.mjs && vitest run`), para que el CI de la Semana 3 (`npm run test -- --run`) y `npm run verify` cubran la suite completa y no solo la prueba del starter.
- **Node declarado** con `engines` en `package.json` y `.nvmrc`, alineado con la versión del CI.
- **Sin `npm audit fix --force`** para no romper la compatibilidad del starter.

## 12. Supuestos

- Todos los datos son sintéticos; no hay datos personales reales ni credenciales en el repositorio.
- El alcance de la Semana 3 es la consulta offline de la interfaz y de los datos sintéticos ya cacheados. El registro offline y la sincronización (RF-02 a RF-04) quedan fuera.
- Las comprobaciones manuales de Service Worker, offline y cachés se hacen sobre el build de producción, en `localhost` (contexto seguro), con Chrome o Edge y sus herramientas de desarrollo.
- El kit de la Semana 3 prefiere trabajo individual sobre el repositorio personal; este equipo entrega sobre un repositorio compartido de tres personas, cada una con su sección en `evidence/individual.md`. Razón operativa: `[COMPLETAR]`.
- `make verify` no es obligatorio en este proyecto; su equivalente exacto es `npm run verify`.

## 13. Limitaciones

- No hay Service Worker, cachés ni funcionamiento offline en `main` (ver sección 1).
- No hay registro de inspecciones, persistencia local, sincronización, API, base de datos ni autenticación.
- `/maintenance` es una estructura inicial sin funcionalidad.
- `EmptyState` existe como componente probado de forma aislada, pero ninguna página lo usa todavía.
- No hay pruebas end-to-end ni de rutas completas; `npm run verify` no evalúa la calidad de los documentos.
- Dependencias con vulnerabilidades heredadas del starter (ver sección 2).
- El soporte PWA varía entre navegadores y sistemas operativos, en especial iOS (ver ADR-001).
- `reports/verification.json` y `vitest-report.json` no se versionan.

## 14. Evidencia de la entrega

- `evidence/individual.md`: una sección por integrante y por semana, con commits, decisiones, pruebas, limitaciones y uso declarado de IA. Cada persona documenta únicamente lo que hizo, probó o decidió.
- `docs/requirements.md` y `docs/decision-record.md`: requisitos y decisión del equipo.
- `docs/integration-checklist.md`: checklist de integración y cierre de la entrega.
- Artefactos de GitHub Actions del SHA entregado: `starter-week-01-evidence`, `pwa-eq11-week-02-vitest-report` y `academic-evidence-w03-service-worker-offline`.
- `docs/cache-strategy.md`: decisión de caché y sus trade-offs (por crear, exigido por el kit).
- SHA final: se obtiene después del último commit con `git rev-parse HEAD` y se pega en Classroom; **no** se escribe dentro de un commit. Cada integrante entrega el mismo repositorio, SHA, enlace a Actions, `reports/verification.json` y `evidence/individual.md`, identificando su sección.

## 15. Estructura y flujo de trabajo

```text
src/app/            rutas (/, /inspections, /maintenance, /test-error), layout, loading y error
src/components/     AppShell y componentes de estado (ui/)
src/lib/data/       datos sintéticos
src/lib/pwa/        registro del Service Worker (por crear, exigido por el kit)
public/             manifest, iconos y, cuando exista, sw.js
tests/              pruebas Vitest y prueba del starter
scripts/            verify.mjs
docs/               requisitos, decisión (ADR-001), estrategia de caché (por crear) y checklist de integración
evidence/           evidencia individual
.github/workflows/  CI (Semana 1 y Semana 2)
```

Flujo: rama individual → commits → push → pull request → revisión → merge a `main`. No se trabaja directamente sobre `main`. No se incluyen datos personales reales, archivos `.env` ni credenciales.
