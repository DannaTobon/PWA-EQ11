# Política de sincronización y conflictos — Semana 05

Todos los datos son sintéticos. Este documento describe la política de revisión manual de conflictos; las decisiones de almacenamiento (Danna) y de cola/idempotencia (Fernando) se complementan con sus secciones.

## 1. Política elegida: revisión manual por inspección

Un conflicto existe cuando `baseRevision` de la operación no coincide con la revisión actual del servidor (HTTP 409). Con la política «gana el servidor» el cambio local dejaría de ser la versión activa y habría que recapturarlo; con mezcla por campo podría resultar una inspección incoherente (estado de una versión y resumen de otra). Por eso se eligió revisión manual: ambas versiones se conservan hasta que una persona decide.

## 2. Comportamiento (`src/lib/sync/conflict-policy.ts`)

| Situación | Resultado |
|---|---|
| Revisión base ≠ revisión del servidor | `registerConflict`: la operación pasa a `conflict` y deja de reintentarse |
| Conflicto abierto | Se guardan versión local y remota (`sync_meta`, clave `conflict:<entityId>`) |
| Operaciones posteriores de la misma inspección | Esperan: `selectRunnableOperations` las excluye |
| Operaciones de otras inspecciones | Continúan con normalidad |
| `acceptServer` | El registro local se reemplaza por la versión remota, la operación se cierra sin enviarse y no se crea otra mutación |
| `keepLocal` | Nueva operación con nuevo `operationId`, `baseRevision` = revisión vigente del servidor |

## 3. Decisiones de detalle

- **Orden de `keepLocal`:** la nueva operación conserva el `createdAt` de la original para ejecutarse antes de las que esperaban. El `operationId` por defecto es determinista (`<id original>:keepLocal:r<revisión>`), por lo que repetir la resolución tras una interrupción no genera operaciones duplicadas.
- **Operaciones en espera tras `keepLocal`:** se reanudan en orden con `baseRevision` = revisión vigente. La cola (Fernando) debe actualizar la `baseRevision` de la siguiente operación del mismo `entityId` al confirmar cada envío.
- **Operaciones en espera tras `acceptServer`:** nacieron sobre la versión local rechazada; no se envían, quedan en `failed` con su contenido y un motivo visible. *Este punto es una interpretación del paso 10 de la división de trabajo y debe confirmarlo el equipo.*
- **Interrupciones:** `registerConflict` escribe primero el registro con ambas versiones y al final el estado de la operación; si la aplicación se cierra a la mitad, la operación se recupera como `inFlight`, se reenvía y el conflicto se detecta de nuevo.
- **Revisión vigente:** `resolveConflict` acepta `remote` con una revisión más reciente consultada al servidor; si falta, usa la guardada al detectar el conflicto.

## 4. Pruebas (`tests/sync.spec.ts`)

Cubren: captura offline y recarga; detección por revisión; conservación de ambas versiones; no reintento; bloqueo por inspección; continuidad de otras inspecciones; `acceptServer` sin nueva mutación; `keepLocal` con nueva operación; recuperación del conflicto tras reiniciar. Con la cola y la API sintética incluidas en el repositorio también cubren: reintento idempotente, respuesta antigua, interrupción `inFlight` y un caso integrado (409 real, bloqueo, continuidad de otra inspección y reanudación tras `keepLocal`). `tests/queue.spec.ts` cubre la cola, los reintentos y la clasificación HTTP.

## 4b. Cola, cliente y API (`src/lib/sync/queue.ts`, `client.ts`, `api-store.ts`)

- Reintentos: se interpretó «tres intentos automáticos» como **tres reintentos** tras el primer envío (1, 2 y 4 s; máximo 4 envíos), configurable mediante `RetryConfig`. Después, `failed` y reintento manual con `retryFailedOperation` (mismo `operationId`).
- HTTP: 408, 429 y 5xx se reintentan; 409 es conflicto; otros 4xx terminan en `failed`.
- Idempotencia: el cliente envía `Idempotency-Key` = `operationId`; la API en memoria devuelve el mismo resultado sin crear otro registro.
- Una confirmación con revisión no posterior a la conocida se ignora (`applyServerConfirmation`).
- Al abrir la cola, las operaciones `inFlight` interrumpidas vuelven a `pending`.
- Las peticiones se procesan en serie: durante una espera de backoff, las demás operaciones también esperan.

## 5. Límites y riesgos

- Las operaciones usan snapshots completos de la inspección; no hay mezcla por campo.
- Los pasos de resolución son escrituras IndexedDB secuenciales (el adaptador solo ofrece transacción conjunta para inspección + operación). El orden elegido es seguro ante interrupciones, no atómico.
- La API sintética pierde su estado al reiniciar y no cubre varias instancias.
- La resolución exige una acción de la persona usuaria; no hay Background Sync: la cola se reanuda al iniciar, con el evento `online` o con reintento manual.

## 6. Cómo reproducir

```bash
npm ci
npx vitest run tests/sync.spec.ts
npm test && npm run build && npm run verify
```
