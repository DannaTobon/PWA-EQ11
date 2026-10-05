import type { Inspection } from "@/lib/data/inspections";

export const STORAGE_DATABASE_NAME = "pwa-eq11-inspections";
export const STORAGE_DATABASE_VERSION = 1;

export const STORAGE_STORES = {
  inspections: "inspections",
  outbox: "outbox",
  syncMeta: "sync_meta"
} as const;

export type OperationStatus = "pending" | "inFlight" | "done" | "failed" | "conflict";

export type OutboxOperationType = "create" | "update";

export type InspectionSyncMetadata = {
  status: OperationStatus;
  baseRevision: number | null;
  pendingOperationId?: string;
  lastSyncedAt?: string;
};

export type StoredInspection = Inspection & {
  sync: InspectionSyncMetadata;
};

export type OutboxOperation = {
  operationId: string;
  entityId: string;
  type: OutboxOperationType;
  payload: Inspection;
  baseRevision: number | null;
  attempts: number;
  status: OperationStatus;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

export type SyncMetaValue = string | number | boolean | null;

export type SyncMetaRecord = {
  key: string;
  value: SyncMetaValue;
  updatedAt: string;
};

const OPERATION_STATUSES: ReadonlySet<OperationStatus> = new Set<OperationStatus>([
  "pending",
  "inFlight",
  "done",
  "failed",
  "conflict"
]);

const OPERATION_TYPES: ReadonlySet<OutboxOperationType> = new Set<OutboxOperationType>(["create", "update"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRevision(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0);
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function isInspection(value: unknown): value is Inspection {
  if (!value || typeof value !== "object") return false;

  const inspection = value as Partial<Inspection>;
  return (
    isNonEmptyString(inspection.id) &&
    isNonEmptyString(inspection.location) &&
    isNonEmptyString(inspection.date) &&
    isNonEmptyString(inspection.inspector) &&
    (inspection.status === "ok" || inspection.status === "attention") &&
    isNonEmptyString(inspection.statusLabel) &&
    Number.isInteger(inspection.findings) &&
    (inspection.findings as number) >= 0 &&
    isNonEmptyString(inspection.summary)
  );
}

export function isStoredInspection(value: unknown): value is StoredInspection {
  if (!isInspection(value)) return false;

  const sync = (value as Partial<StoredInspection>).sync;
  return Boolean(
    sync &&
      OPERATION_STATUSES.has(sync.status) &&
      isRevision(sync.baseRevision) &&
      (sync.pendingOperationId === undefined || isNonEmptyString(sync.pendingOperationId)) &&
      (sync.lastSyncedAt === undefined || isIsoDateTime(sync.lastSyncedAt))
  );
}

export function isOutboxOperation(value: unknown): value is OutboxOperation {
  if (!value || typeof value !== "object") return false;

  const operation = value as Partial<OutboxOperation>;
  return (
    isNonEmptyString(operation.operationId) &&
    isNonEmptyString(operation.entityId) &&
    OPERATION_TYPES.has(operation.type as OutboxOperationType) &&
    isInspection(operation.payload) &&
    operation.payload.id === operation.entityId &&
    isRevision(operation.baseRevision) &&
    Number.isInteger(operation.attempts) &&
    (operation.attempts as number) >= 0 &&
    OPERATION_STATUSES.has(operation.status as OperationStatus) &&
    isIsoDateTime(operation.createdAt) &&
    isIsoDateTime(operation.updatedAt) &&
    (operation.lastError === undefined || typeof operation.lastError === "string")
  );
}

export function assertStoredInspection(value: unknown): asserts value is StoredInspection {
  if (!isStoredInspection(value)) {
    throw new TypeError("La inspección local no cumple el esquema de almacenamiento.");
  }
}

export function assertOutboxOperation(value: unknown): asserts value is OutboxOperation {
  if (!isOutboxOperation(value)) {
    throw new TypeError("La operación no cumple el esquema del outbox.");
  }
}
