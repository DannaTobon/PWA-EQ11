import { describe, expect, it } from "vitest";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";
import { isInspection, isOutboxOperation, isStoredInspection } from "@/lib/storage/schema";

// Datos exclusivamente sintéticos. Estas pruebas ejercitan las reglas puras de
// validación que protegen IndexedDB y la outbox antes de cualquier escritura.
const inspection: Inspection = {
  id: "local-inspection-unit-001",
  location: "Laboratorio Sintético de Redes",
  date: "2026-10-25",
  inspector: "Técnica Sintética Unit",
  status: "ok",
  statusLabel: "Sin incidencias",
  findings: 0,
  summary: "Inspección sintética para validar el esquema."
};

const storedInspection: StoredInspection = {
  ...inspection,
  sync: {
    status: "pending",
    baseRevision: null,
    pendingOperationId: "operation-unit-001"
  }
};

const operation: OutboxOperation = {
  operationId: "operation-unit-001",
  entityId: inspection.id,
  type: "create",
  payload: inspection,
  baseRevision: null,
  attempts: 0,
  status: "pending",
  createdAt: "2026-10-25T10:00:00.000Z",
  updatedAt: "2026-10-25T10:00:00.000Z"
};

describe("regla de validación de una inspección", () => {
  it("acepta una inspección sintética completa", () => {
    expect(isInspection(inspection)).toBe(true);
    expect(isInspection({ ...inspection, status: "attention", statusLabel: "Requiere atención", findings: 3 })).toBe(true);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["un texto", "inspección"],
    ["un arreglo", []],
    ["sin identificador", { ...inspection, id: "" }],
    ["identificador en blanco", { ...inspection, id: "   " }],
    ["sin laboratorio", { ...inspection, location: "" }],
    ["sin fecha", { ...inspection, date: "" }],
    ["sin responsable", { ...inspection, inspector: "" }],
    ["un estado desconocido", { ...inspection, status: "done" }],
    ["sin etiqueta de estado", { ...inspection, statusLabel: "" }],
    ["hallazgos negativos", { ...inspection, findings: -1 }],
    ["hallazgos decimales", { ...inspection, findings: 1.5 }],
    ["hallazgos de texto", { ...inspection, findings: "2" }],
    ["hallazgos NaN", { ...inspection, findings: Number.NaN }],
    ["sin resumen", { ...inspection, summary: "" }]
  ])("rechaza %s", (_label, value) => {
    expect(isInspection(value)).toBe(false);
  });
});

describe("regla de validación del registro almacenado", () => {
  it("acepta estados pending, done y conflict con metadatos válidos", () => {
    expect(isStoredInspection(storedInspection)).toBe(true);
    expect(
      isStoredInspection({
        ...storedInspection,
        sync: { status: "done", baseRevision: 2, lastSyncedAt: "2026-10-25T11:00:00.000Z" }
      })
    ).toBe(true);
    expect(
      isStoredInspection({
        ...storedInspection,
        sync: { status: "conflict", baseRevision: 1, pendingOperationId: "operation-unit-002" }
      })
    ).toBe(true);
  });

  it.each<[string, unknown]>([
    ["sin bloque sync", { ...inspection }],
    ["sync nulo", { ...storedInspection, sync: null }],
    ["estado de sincronización desconocido", { ...storedInspection, sync: { ...storedInspection.sync, status: "unknown" } }],
    ["revisión base negativa", { ...storedInspection, sync: { ...storedInspection.sync, baseRevision: -1 } }],
    ["revisión base decimal", { ...storedInspection, sync: { ...storedInspection.sync, baseRevision: 1.5 } }],
    ["operación pendiente vacía", { ...storedInspection, sync: { ...storedInspection.sync, pendingOperationId: "" } }],
    ["fecha de sincronización inválida", { ...storedInspection, sync: { ...storedInspection.sync, lastSyncedAt: "ayer" } }]
  ])("rechaza %s", (_label, value) => {
    expect(isStoredInspection(value)).toBe(false);
  });
});

describe("regla de validación de una operación de la cola", () => {
  it("acepta operaciones create y update válidas", () => {
    expect(isOutboxOperation(operation)).toBe(true);
    expect(
      isOutboxOperation({
        ...operation,
        type: "update",
        baseRevision: 1,
        payload: { ...inspection, summary: "Resumen sintético actualizado." }
      })
    ).toBe(true);
  });

  it.each<[string, unknown]>([
    ["sin operationId", { ...operation, operationId: "" }],
    ["sin entityId", { ...operation, entityId: "" }],
    ["un tipo desconocido", { ...operation, type: "delete" }],
    ["un payload de otra entidad", { ...operation, payload: { ...inspection, id: "otra-inspeccion" } }],
    ["una revisión base negativa", { ...operation, baseRevision: -1 }],
    ["intentos negativos", { ...operation, attempts: -1 }],
    ["intentos decimales", { ...operation, attempts: 1.2 }],
    ["un estado desconocido", { ...operation, status: "unknown" }],
    ["createdAt inválido", { ...operation, createdAt: "ayer" }],
    ["updatedAt vacío", { ...operation, updatedAt: "" }],
    ["lastError no textual", { ...operation, lastError: 42 }]
  ])("rechaza %s", (_label, value) => {
    expect(isOutboxOperation(value)).toBe(false);
  });
});
