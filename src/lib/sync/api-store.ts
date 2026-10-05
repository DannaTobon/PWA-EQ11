import { isInspection } from "@/lib/storage/schema";
import type { Inspection } from "@/lib/data/inspections";
import { hasRevisionConflict } from "@/lib/sync/conflict-policy";

/**
 * Receptor académico en memoria para demostrar idempotencia y conflictos.
 * Pierde su estado al reiniciar el servidor y no sirve para varias instancias.
 */
export type ServerRecord = { inspection: Inspection; revision: number };
export type MutationResponse = { status: 200 | 400 | 404 | 409; body: Record<string, unknown> };

const records = new Map<string, ServerRecord>();
const processed = new Map<string, MutationResponse>();

export function resetServerStore(): void {
  records.clear();
  processed.clear();
}

export function getServerRecord(entityId: string): ServerRecord | undefined {
  return records.get(entityId);
}

export function countServerRecords(): number {
  return records.size;
}

export function applyMutation(input: unknown, idempotencyKey?: string | null): MutationResponse {
  const m = input as Record<string, unknown> | null;
  const valid =
    m &&
    typeof m.operationId === "string" &&
    m.operationId.trim() !== "" &&
    typeof m.entityId === "string" &&
    (m.type === "create" || m.type === "update") &&
    isInspection(m.payload) &&
    m.payload.id === m.entityId &&
    (m.baseRevision === null || (Number.isInteger(m.baseRevision) && (m.baseRevision as number) >= 0));
  if (!valid) return { status: 400, body: { error: "Mutación inválida." } };
  if (idempotencyKey && idempotencyKey !== m.operationId) {
    return { status: 400, body: { error: "Idempotency-Key no coincide con operationId." } };
  }

  const operationId = m.operationId as string;
  const entityId = m.entityId as string;
  const baseRevision = m.baseRevision as number | null;
  const payload = m.payload as Inspection;

  // Misma operación: mismo resultado, sin crear otro registro.
  const previous = processed.get(operationId);
  if (previous) return previous;

  const current = records.get(entityId);
  if (!current && baseRevision !== null) {
    return { status: 404, body: { error: "La inspección no existe en el servidor." } };
  }
  if (current && hasRevisionConflict(baseRevision, current.revision)) {
    return { status: 409, body: { error: "Conflicto de revisión.", remote: current } };
  }

  const saved: ServerRecord = { inspection: payload, revision: (current?.revision ?? 0) + 1 };
  records.set(entityId, saved);
  const response: MutationResponse = { status: 200, body: { revision: saved.revision, inspection: saved.inspection } };
  processed.set(operationId, response);
  return response;
}
