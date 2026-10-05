import {
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  saveInspection,
  saveOutboxOperation,
  updateOutboxOperation
} from "@/lib/storage/indexeddb";
import { assertOutboxOperation, type OutboxOperation } from "@/lib/storage/schema";
import { registerConflict, selectRunnableOperations } from "@/lib/sync/conflict-policy";
import type { SendFn } from "@/lib/sync/client";

/** Configuración académica: tres reintentos automáticos tras el primer envío, con espera de 1, 2 y 4 s. */
export type RetryConfig = { maxRetries: number; backoffMs: readonly number[] };
export const DEFAULT_RETRY_CONFIG: RetryConfig = { maxRetries: 3, backoffMs: [1000, 2000, 4000] };

export type QueueOptions = {
  send: SendFn;
  retry?: RetryConfig;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  connection?: IDBDatabase;
};

export type QueueSummary = { done: string[]; failed: string[]; conflicts: string[]; retries: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const defaultNow = () => new Date().toISOString();

/** Espera previa al reintento número `retryNumber` (1, 2, 3...). */
export function backoffDelay(retryNumber: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const index = Math.min(Math.max(retryNumber, 1), config.backoffMs.length) - 1;
  return config.backoffMs[index];
}

/** Agrega una operación; un operationId repetido no se vuelve a agregar. */
export async function enqueue(
  operation: OutboxOperation,
  connection?: IDBDatabase
): Promise<{ added: boolean; operation: OutboxOperation }> {
  assertOutboxOperation(operation);
  const existing = await getOutboxOperation(operation.operationId, connection);
  if (existing) return { added: false, operation: existing };
  await saveOutboxOperation(operation, connection);
  return { added: true, operation };
}

export async function getPendingOperations(connection?: IDBDatabase): Promise<OutboxOperation[]> {
  return selectRunnableOperations(await getAllOutboxOperations(connection));
}

/** Operaciones que quedaron `inFlight` por un cierre inesperado vuelven a `pending` (misma clave y mismos intentos). */
export async function recoverInterruptedOperations(options: { now?: () => string; connection?: IDBDatabase } = {}): Promise<string[]> {
  const { now = defaultNow, connection } = options;
  const interrupted = (await getAllOutboxOperations(connection)).filter((operation) => operation.status === "inFlight");
  for (const operation of interrupted) {
    await updateOutboxOperation(
      operation.operationId,
      { status: "pending", updatedAt: now(), lastError: "Envío interrumpido; recuperada al reanudar la cola." },
      connection
    );
  }
  return interrupted.map((operation) => operation.operationId);
}

/** Reintento manual tras agotar los automáticos: conserva el operationId y reinicia el contador. */
export async function retryFailedOperation(operationId: string, options: { now?: () => string; connection?: IDBDatabase } = {}) {
  const operation = await getOutboxOperation(operationId, options.connection);
  if (!operation || operation.status !== "failed") throw new Error(`La operación ${operationId} no está en estado failed.`);
  return updateOutboxOperation(operationId, { status: "pending", attempts: 0, updatedAt: (options.now ?? defaultNow)() }, options.connection);
}

/**
 * Aplica una confirmación del servidor. Una respuesta cuya revisión no sea posterior a la conocida
 * (respuesta antigua o repetida) no modifica el registro local.
 */
export async function applyServerConfirmation(
  operation: OutboxOperation,
  revision: number,
  options: { now?: () => string; connection?: IDBDatabase } = {}
): Promise<"applied" | "stale" | "missing"> {
  const { now = defaultNow, connection } = options;
  const current = await getInspection(operation.entityId, connection);
  if (!current) return "missing";
  const known = current.sync.baseRevision;
  if (known !== null && revision <= known) return "stale";

  if (current.sync.pendingOperationId === operation.operationId) {
    // Era el último cambio local: la inspección queda sincronizada.
    await saveInspection({ ...current, sync: { status: "done", baseRevision: revision, lastSyncedAt: now() } }, connection);
  } else {
    // Hay cambios locales posteriores: solo se avanza la revisión conocida.
    await saveInspection({ ...current, sync: { ...current.sync, baseRevision: revision } }, connection);
  }

  // Las operaciones siguientes de la misma inspección parten de la nueva revisión.
  const next = (await getAllOutboxOperations(connection)).filter(
    (item) => item.entityId === operation.entityId && item.status === "pending" && item.operationId !== operation.operationId
  );
  for (const item of next) {
    await updateOutboxOperation(item.operationId, { baseRevision: revision, updatedAt: now() }, connection);
  }
  return "applied";
}

/** Procesa las operaciones ejecutables en orden de creación hasta que no quede ninguna. */
export async function processQueue(options: QueueOptions): Promise<QueueSummary> {
  const { send, retry = DEFAULT_RETRY_CONFIG, sleep = defaultSleep, now = defaultNow, connection } = options;
  const summary: QueueSummary = { done: [], failed: [], conflicts: [], retries: 0 };

  await recoverInterruptedOperations({ now, connection });

  for (;;) {
    const next = selectRunnableOperations(await getAllOutboxOperations(connection))[0];
    if (!next) return summary;

    const attempts = next.attempts + 1;
    await updateOutboxOperation(next.operationId, { status: "inFlight", attempts, updatedAt: now() }, connection);

    let result;
    try {
      result = await send({ ...next, status: "inFlight", attempts });
    } catch (error) {
      result = { kind: "retryable" as const, error: error instanceof Error ? error.message : "Error de red" };
    }

    if (result.kind === "ok") {
      await applyServerConfirmation(next, result.revision, { now, connection });
      await updateOutboxOperation(next.operationId, { status: "done", updatedAt: now(), lastError: undefined }, connection);
      summary.done.push(next.operationId);
    } else if (result.kind === "conflict") {
      await registerConflict(next.operationId, result.remote, { now, connection });
      summary.conflicts.push(next.operationId);
    } else if (result.kind === "retryable" && attempts - 1 < retry.maxRetries) {
      await updateOutboxOperation(next.operationId, { status: "pending", updatedAt: now(), lastError: result.error }, connection);
      summary.retries += 1;
      await sleep(backoffDelay(attempts, retry));
    } else {
      await updateOutboxOperation(next.operationId, { status: "failed", updatedAt: now(), lastError: result.error }, connection);
      summary.failed.push(next.operationId);
    }
  }
}
