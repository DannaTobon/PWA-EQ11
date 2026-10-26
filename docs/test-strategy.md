# Estrategia de pruebas — Semana 08 (Pirámide de pruebas e integración continua)

**Equipo:** DMI-EQ11C / PWA-EQ11 — Danna, Tonanzin y Fernando.
**Alcance:** PWA de inspecciones de laboratorio (Next.js 14, IndexedDB, cola de sincronización, Service Worker).
**Datos:** exclusivamente sintéticos. No hay PII, secretos, tokens ni respuestas de quizzes.

## 1. Contexto y alcance

La aplicación permite capturar inspecciones sin conexión, guardarlas en IndexedDB, enviarlas con una cola con reintentos e idempotencia y mostrarlas tras recargar. Esta semana se organizó la suite en tres capas (unitaria, integración y E2E) más una etapa de CI que las ejecuta todas. No se agregaron capacidades nuevas: el objetivo es demostrar que las pruebas detectan regresiones reales.

## 2. Matriz riesgo → capa → evidencia

| Riesgo | Por qué importa | Capa | Archivo | Aserción clave | Responsable |
|---|---|---|---|---|---|
| Captura inválida (vacíos, hallazgos negativos o decimales, estado desconocido) | No debe llegar basura a IndexedDB ni al outbox | Unitaria | `tests/unit/validation.spec.ts` | `isInspection`, `isStoredInspection` e `isOutboxOperation` rechazan entradas inválidas | Danna |
| Operación no ejecutable, orden incorrecto o confirmación repetida | Evita envíos indebidos y pérdida de cambios locales | Unitaria | `tests/unit/queue-rules.spec.ts` | Selección, backoff 1/2/4 s y `applyServerConfirmation` (`applied`, `stale`, `missing`) | Danna |
| Persistencia tras cerrar y reabrir la base | La inspección debe sobrevivir a una recarga | Integración | `tests/integration/offline-persistence.spec.ts` | Tras reabrir, existen inspección y operación con el mismo `operationId` y estado `pending` | Tonanzin |
| Escritura parcial (inspección sin operación o al revés) | Una captura a medias se perdería o se enviaría mal | Integración | `tests/integration/offline-persistence.spec.ts` | Datos incoherentes lanzan error y no dejan registros; un fallo a mitad de la transacción revierte la inspección | Tonanzin |
| Duplicado al reintentar la misma operación | El mismo `operationId` no puede crear dos registros ni dos revisiones | Integración | `tests/integration/duplicate-sync.spec.ts` | Con respuesta perdida, el reintento termina `done`, `countServerRecords() === 1` y revisión 1 | Tonanzin |
| Misma clave de idempotencia dos veces | Es la guarda del servidor que cubre el defecto controlado | Integración | `tests/integration/duplicate-sync.spec.ts` | La segunda respuesta es idéntica a la primera y la revisión no avanza | Tonanzin |
| Conflicto de revisión | No se debe pisar la versión remota ni bloquear otras inspecciones | Integración | `tests/integration/duplicate-sync.spec.ts` | La segunda operación queda en `conflict`, hay un registro por entidad y otra inspección sí sincroniza | Tonanzin |
| Cierre inesperado con una operación `inFlight` | La operación debe recuperarse sin duplicarse | Integración | `tests/integration/duplicate-sync.spec.ts` | `recoverInterruptedOperations` la devuelve a `pending` con el mismo `operationId` y se envía una sola vez | Tonanzin |
| Permiso de notificaciones denegado | La captura debe completarse sin la capacidad opcional | E2E | `tests/e2e/capability-denied.spec.ts` | Se guarda la inspección aunque el permiso no se conceda | Fernando |
| Flujo crear → offline → recargar → reconectar | Es el comportamiento crítico de la PWA | E2E | `tests/e2e/offline-sync.spec.ts` | Una tarjeta `Pendiente` tras recargar offline y `Sincronizada` al reconectar, sin duplicados | Fernando |
| SW no registrado o shell no disponible | Sin esto no existe PWA offline | E2E + unitaria | `tests/e2e/offline-sync.spec.ts`, `tests/register-service-worker.spec.ts` | El SW controla `/inspecciones` y el registro funciona con `load` ya ocurrido | Danna + Fernando |

## 3. Por qué cada capa y qué no cubre

- **Unitaria.** Reglas puras y contratos pequeños, sin navegador ni red; son rápidas y localizan el fallo con precisión. No demuestran que IndexedDB, el Service Worker o los permisos funcionen.
- **Integración.** Usa `fake-indexeddb`, la cola real y el receptor real en memoria (`applyMutation`). Comprueba transacciones, orden, reintentos e idempotencia. La idempotencia se prueba contra el receptor real y no con un mock, porque el defecto vive en la guarda del servidor: un mock que "siempre responde bien" no lo detectaría. No demuestra el ciclo de vida del navegador ni usa un IndexedDB real.
- **E2E.** Chromium real, Service Worker real, `context.setOffline()` y permisos simulados. Es la única capa que demuestra el flujo completo, pero es la más lenta y frágil; por eso se limita al flujo crítico y a una capacidad denegada.
- **Suite existente (semanas 1–6).** Funciona como red de regresión y no se duplica. La correspondencia con las pruebas nuevas está en la sección 16.5 del `README.md`.

## 4. Diagnóstico inicial

Antes de integrar se ejecutó la suite y se probó un flujo real en Chromium sobre `next build && next start`. Aparecieron tres fallos que las pruebas previas no detectaban:

1. **El Service Worker no se registraba en producción.** El listener de `load` se agregaba dentro de un `useEffect`; la hidratación ocurre después de `load`, así que el registro nunca se solicitaba. Corregido por Danna (registro inmediato si `document.readyState === "complete"`).
2. **La recarga sin conexión ocultaba la vista local durante los reintentos.** `useInspectionSync` sincronizaba al montar aunque no hubiera red y la interfaz parecía vacía unos 7 s. Corregido por Danna (sin conexión se cargan primero los datos locales y se espera el evento `online`).
3. **El lint interpretaba `useDatabase` como un hook.** Se renombró a `withDatabase` para no desactivar `react-hooks/rules-of-hooks`.

Evidencia: PR de Danna <https://github.com/DannaTobon/PWA-EQ11/pull/16> (commits `efc94f2`, `4a284ff`, `29ba7b7`, `9d19d87`). PR de Fernando: *(pendiente: completar con el enlace real al PR de `test/w08-e2e-fernando`)*.

## 5. Comandos locales

```bash
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:coverage
npm run build
npm run test:e2e      # Playwright arranca `npm start` solo; requiere build previo
npm run verify        # lint + tipos + starter + cobertura + build (no ejecuta E2E)
npm run verify:full   # verify + E2E
```

## 6. Integración continua

Workflow: `.github/workflows/academic-evaluation.yml`. Se ejecuta en `push`, `pull_request` y `workflow_dispatch`, con `permissions: contents: read`, sin secretos y sin `pull_request_target`.

- **Etapas:** checkout → Node `20.19.6` → `npm ci` → lint → typecheck → unitarias → integración → cobertura → build → `npx playwright install --with-deps chromium` → E2E → subida de artefactos.
- **Artefactos** (`if: always()`): `coverage/`, `vitest-report.json`, `test-results/`, `playwright-report/` y `reports/verification.json`.
- Ninguna etapa de calidad usa `continue-on-error`.
- `npm run test:coverage` vuelve a ejecutar Vitest completo. Es deliberado: así el reporte de cobertura incluye unitarias, integración y suite existente sin quedar fragmentado. El costo es tiempo de CI; si crece, se puede consolidar en una sola ejecución con cobertura y explicarlo en el README.
- Los checks públicos son retroalimentación; la calificación final usa el commit fijado y los checks privados.

## 7. Defecto controlado

- **Hipótesis:** si se quita la guarda de idempotencia del receptor (`if (previous) return previous;` en `src/lib/sync/api-store.ts`), la suite de integración debe fallar.
- **Cambio:** en la rama temporal `tmp/w08-defecto-idempotencia` se comentó esa línea con la marca `// DEFECTO CONTROLADO SEMANA 08`. La rama nunca se fusiona a `main`.
- **Prueba que falla:** `tests/integration/duplicate-sync.spec.ts`. Sin la guarda, el reintento repite una mutación ya aplicada, el receptor la trata como un conflicto de revisión (409) y la operación no llega a `done`; además, la segunda respuesta con la misma clave deja de ser idéntica a la primera.
- **Comprobación local previa (en un contenedor, sin CI):** con la guarda comentada, `npm run test:integration` dio 2 pruebas fallidas de 11 (reintento tras respuesta perdida y misma clave de idempotencia); al restaurar el archivo, las 11 pasaron.
- **Run rojo en Actions:** *(pendiente: pegar la URL del run fallido de la rama temporal)*.
- **Reversión:** `git revert --no-edit HEAD` y `git push`.
- **Run verde tras revertir:** *(pendiente: pegar la URL del run verde de la misma rama)*.
- **Conclusión:** *(completar tras ver ambos runs)* La prueba falla por la causa correcta y vuelve a pasar al revertir; no se simuló el fallo con `|| true` ni `continue-on-error`.

## 8. Cobertura

La cobertura (`@vitest/coverage-v8`) mide qué líneas de `src/` ejecutó Vitest. No mide E2E ni código que solo corre en el navegador, y una línea ejecutada no es una línea verificada. Se usa como señal de huecos, no como medida de calidad. El reporte está en `coverage/index.html` (se publica como artefacto de CI).

## 9. Límites y riesgos

- El Service Worker cachea `/inspecciones` al visitarla; un arranque en frío totalmente offline cae en `offline.html`.
- El receptor (`src/lib/sync/api-store.ts`) es en memoria y de una sola instancia: demuestra idempotencia, no es una base de datos ni funciona con varias instancias.
- `fake-indexeddb` no reproduce todos los comportamientos de IndexedDB de un navegador real; por eso existe el E2E.
- La cámara de Semana 06 sigue en `feature/w06-camera-fernando`, sin fusionar, y no se usa en esta actividad.
- `tests/capabilities.spec.ts` conserva 3 pruebas `todo` (cámara y almacenamiento auxiliar). No cuentan como aprobadas.
- El E2E solo corre en Chromium headless y con permisos simulados.

## 10. Trazabilidad con la entrega

| Entregable | Dónde está |
|---|---|
| Pruebas unitarias | `tests/unit/` |
| Pruebas de integración | `tests/integration/` |
| Pruebas E2E | `tests/e2e/` |
| Estrategia y diagnóstico | este documento |
| CI | `.github/workflows/academic-evaluation.yml` |
| Verificador local | `scripts/verify.mjs` (`npm run verify`, `npm run verify:full`) |
| Setup, comandos y límites | `README.md`, sección 16 |
| Evidencia y declaración de IA | `evidence/individual.md` |
