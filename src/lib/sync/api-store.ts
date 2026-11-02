import type { Inspection } from "@/lib/data/inspections";
import { isPlainObject, validateInspectionMutation } from "@/lib/security";
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
  if (!isPlainObject(input)) return { status: 400, body: { error: "Mutación inválida." } };

  // El receptor interno también acepta un OutboxOperation completo. Proyectar los campos
  // de transporte mantiene esa compatibilidad y aplica el mismo contrato centralizado.
  const validation = validateInspectionMutation({
    operationId: input.operationId,
    entityId: input.entityId,
    type: input.type,
    payload: input.payload,
    baseRevision: input.baseRevision
  });
  if (!validation.success) return { status: 400, body: { error: "Mutación inválida." } };

  const mutation = validation.data;
  if (idempotencyKey && idempotencyKey.trim() !== mutation.operationId) {
    return { status: 400, body: { error: "Idempotency-Key no coincide con operationId." } };
  }

  const { operationId, entityId, baseRevision, payload } = mutation;

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
