import {
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  getSyncMeta,
  saveInspection,
  saveOutboxOperation,
  saveSyncMeta,
  updateOutboxOperation
} from "@/lib/storage/indexeddb";
import { isInspection, type OutboxOperation, type StoredInspection } from "@/lib/storage/schema";
import type { Inspection } from "@/lib/data/inspections";

/**
 * Política de conflictos: revisión manual (docs/sync-policy.md).
 *
 * - Un conflicto existe cuando la revisión base de la operación no coincide con la revisión del servidor.
 * - La operación pasa a `conflict`, deja de reintentarse y se conservan la versión local y la remota.
 * - El bloqueo es por `entityId`: las demás inspecciones siguen sincronizándose.
 * - Solo una decisión explícita (`keepLocal` o `acceptServer`) cierra el conflicto.
 */

export type ConflictDecision = "keepLocal" | "acceptServer";

export type ServerSnapshot = {
  inspection: Inspection;
  revision: number;
};

export type ConflictRecord = {
  entityId: string;
  operationId: string;
  baseRevision: number | null;
  remoteRevision: number;
  local: Inspection;
  remote: Inspection;
  detectedAt: string;
};

export type ConflictOptions = {
  now?: () => string;
  connection?: IDBDatabase;
};

export type ResolveOptions = ConflictOptions & {
  /** Revisión vigente del servidor si se consultó de nuevo; si falta se usa la guardada al detectar el conflicto. */
  remote?: ServerSnapshot;
  /** Genera el operationId de la nueva operación de `keepLocal`. Por defecto es determinista (resolución idempotente). */
  createOperationId?: (conflictOperation: OutboxOperation, remoteRevision: number) => string;
};

export type ResolveResult = {
  decision: ConflictDecision;
  entityId: string;
  newOperation?: OutboxOperation;
  resumedOperationIds: string[];
  discardedOperationIds: string[];
};

const defaultNow = () => new Date().toISOString();
const conflictKey = (entityId: string) => `conflict:${entityId}`;

/** Detecta conflicto comparando la revisión base del cliente con la revisión actual del servidor. */
export function hasRevisionConflict(baseRevision: number | null, remoteRevision: number | null): boolean {
  return baseRevision !== remoteRevision;
}

/** Inspecciones cuyas operaciones posteriores deben esperar. */
export function getBlockedEntityIds(operations: readonly OutboxOperation[]): Set<string> {
  return new Set(operations.filter((operation) => operation.status === "conflict").map((operation) => operation.entityId));
}

/** Operaciones que la cola puede enviar: pendientes, en orden de creación y sin su inspección bloqueada. */
export function selectRunnableOperations(operations: readonly OutboxOperation[]): OutboxOperation[] {
  const blocked = getBlockedEntityIds(operations);
  return operations
    .filter((operation) => operation.status === "pending" && !blocked.has(operation.entityId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.operationId.localeCompare(b.operationId));
}

export async function getConflict(entityId: string, connection?: IDBDatabase): Promise<ConflictRecord | undefined> {
  const meta = await getSyncMeta(conflictKey(entityId), connection);
  if (!meta || typeof meta.value !== "string") return undefined;

  const parsed = JSON.parse(meta.value) as Partial<ConflictRecord>;
  if (!parsed || !isInspection(parsed.local) || !isInspection(parsed.remote)) {
    throw new TypeError("El registro de conflicto almacenado no es válido.");
  }
  return parsed as ConflictRecord;
}

export async function listConflicts(connection?: IDBDatabase): Promise<ConflictRecord[]> {
  const operations = await getAllOutboxOperations(connection);
  const entityIds = Array.from(getBlockedEntityIds(operations));
  const records = await Promise.all(entityIds.map((entityId) => getConflict(entityId, connection)));
  return records.filter((record): record is ConflictRecord => record !== undefined);
}

/**
 * Registra un conflicto (HTTP 409). Orden de escritura pensado para interrupciones:
 * primero el registro con ambas versiones y al final el estado de la operación. Si la aplicación se
 * cierra a la mitad, la operación sigue `inFlight`, se recupera, se reenvía y el conflicto se detecta otra vez.
 */
export async function registerConflict(
  operationId: string,
  remote: ServerSnapshot,
  options: ConflictOptions = {}
): Promise<ConflictRecord> {
  const { connection, now = defaultNow } = options;
  const operation = await getOutboxOperation(operationId, connection);
  if (!operation) throw new Error(`No existe la operación ${operationId}.`);
  if (!isInspection(remote.inspection) || !Number.isInteger(remote.revision) || remote.revision < 0) {
    throw new TypeError("La versión remota del conflicto no es válida.");
  }
  if (!hasRevisionConflict(operation.baseRevision, remote.revision)) {
    throw new Error("La revisión remota coincide con la revisión base: no hay conflicto.");
  }

  const timestamp = now();
  const record: ConflictRecord = {
    entityId: operation.entityId,
    operationId: operation.operationId,
    baseRevision: operation.baseRevision,
    remoteRevision: remote.revision,
    local: operation.payload,
    remote: remote.inspection,
    detectedAt: timestamp
  };

  await saveSyncMeta({ key: conflictKey(operation.entityId), value: JSON.stringify(record), updatedAt: timestamp }, connection);
  await updateOutboxOperation(
    operation.operationId,
    {
      status: "conflict",
      updatedAt: timestamp,
      lastError: `Conflicto: la revisión base (${operation.baseRevision ?? "ninguna"}) no coincide con la del servidor (${remote.revision}).`
    },
    connection
  );

  const local = await getInspection(operation.entityId, connection);
  if (local) {
    await saveInspection({ ...local, sync: { ...local.sync, status: "conflict" } }, connection);
  }
  return record;
}

/** Resuelve un conflicto con una decisión explícita. */
export async function resolveConflict(
  entityId: string,
  decision: ConflictDecision,
  options: ResolveOptions = {}
): Promise<ResolveResult> {
  const { connection, now = defaultNow } = options;
  if (decision !== "keepLocal" && decision !== "acceptServer") {
    throw new TypeError("La decisión debe ser keepLocal o acceptServer.");
  }

  const record = await getConflict(entityId, connection);
  if (!record) throw new Error(`La inspección ${entityId} no tiene un conflicto abierto.`);

  const conflictOperation = await getOutboxOperation(record.operationId, connection);
  if (!conflictOperation) throw new Error(`No existe la operación en conflicto ${record.operationId}.`);

  const remote: ServerSnapshot = options.remote ?? { inspection: record.remote, revision: record.remoteRevision };
  const timestamp = now();
  const waiting = (await getAllOutboxOperations(connection))
    .filter(
      (operation) =>
        operation.entityId === entityId && operation.operationId !== record.operationId && operation.status === "pending"
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const result: ResolveResult = { decision, entityId, resumedOperationIds: [], discardedOperationIds: [] };

  if (decision === "acceptServer") {
    // 1. El registro local pasa a ser la versión del servidor; no se envía ninguna mutación.
    const accepted: StoredInspection = {
      ...remote.inspection,
      sync: { status: "done", baseRevision: remote.revision, lastSyncedAt: timestamp }
    };
    await saveInspection(accepted, connection);

    // 2. Las operaciones en espera nacieron sobre la versión local descartada: no se envían, se conservan visibles.
    for (const operation of waiting) {
      await updateOutboxOperation(
        operation.operationId,
        {
          status: "failed",
          updatedAt: timestamp,
          lastError: "Descartada al aceptar la versión del servidor; dependía de la versión local rechazada."
        },
        connection
      );
      result.discardedOperationIds.push(operation.operationId);
    }

    // 3. Cierra la operación en conflicto sin reenviarla.
    await updateOutboxOperation(
      conflictOperation.operationId,
      { status: "done", updatedAt: timestamp, lastError: "Conflicto resuelto: se aceptó la versión del servidor." },
      connection
    );
  } else {
    // 1. Nueva operación con nuevo operationId, basada en la revisión vigente del servidor.
    //    Conserva el createdAt de la original para quedar antes de las que esperan.
    const createOperationId =
      options.createOperationId ??
      ((operation: OutboxOperation, revision: number) => `${operation.operationId}:keepLocal:r${revision}`);
    const newOperation: OutboxOperation = {
      operationId: createOperationId(conflictOperation, remote.revision),
      entityId,
      type: "update",
      payload: record.local,
      baseRevision: remote.revision,
      attempts: 0,
      status: "pending",
      createdAt: conflictOperation.createdAt,
      updatedAt: timestamp
    };
    await saveOutboxOperation(newOperation, connection);
    result.newOperation = newOperation;

    // 2. La operación original queda cerrada; ya no se reenvía.
    await updateOutboxOperation(
      conflictOperation.operationId,
      {
        status: "done",
        updatedAt: timestamp,
        lastError: `Conflicto resuelto: se conservó la versión local mediante ${newOperation.operationId}.`
      },
      connection
    );

    // 3. Las operaciones en espera se reanudan en orden sobre la revisión vigente.
    for (const operation of waiting) {
      await updateOutboxOperation(operation.operationId, { baseRevision: remote.revision, updatedAt: timestamp }, connection);
      result.resumedOperationIds.push(operation.operationId);
    }

    // 4. El registro local conserva la última versión local, ahora pendiente de enviarse.
    const local = await getInspection(entityId, connection);
    const lastPending = waiting.at(-1)?.operationId ?? newOperation.operationId;
    if (local) {
      await saveInspection(
        { ...local, sync: { ...local.sync, status: "pending", baseRevision: remote.revision, pendingOperationId: lastPending } },
        connection
      );
    }
  }

  // Último paso: cerrar el registro del conflicto (value null = cerrado).
  await saveSyncMeta({ key: conflictKey(entityId), value: null, updatedAt: timestamp }, connection);
  return result;
}
