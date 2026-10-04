import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeStorageDatabase,
  deleteStorageDatabase,
  getAllInspections,
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  openStorageDatabase,
  saveInspection,
  saveInspectionWithOperation,
  saveOutboxOperation
} from "@/lib/storage/indexeddb";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";

const inspection: Inspection = {
  id: "local-inspection-001",
  location: "Laboratorio Sintético de Redes",
  date: "2026-09-29",
  inspector: "Técnica Sintética A",
  status: "attention",
  statusLabel: "Requiere atención",
  findings: 1,
  summary: "Hallazgo sintético para comprobar almacenamiento local."
};

const storedInspection: StoredInspection = {
  ...inspection,
  sync: {
    status: "pending",
    baseRevision: null,
    pendingOperationId: "operation-001"
  }
};

const operation: OutboxOperation = {
  operationId: "operation-001",
  entityId: inspection.id,
  type: "create",
  payload: inspection,
  baseRevision: null,
  attempts: 0,
  status: "pending",
  createdAt: "2026-09-29T12:00:00.000Z",
  updatedAt: "2026-09-29T12:00:00.000Z"
};

describe("adaptador IndexedDB de inspecciones", () => {
  beforeEach(async () => {
    await deleteStorageDatabase();
  });

  afterEach(async () => {
    await deleteStorageDatabase();
  });

  it("almacena una inspección válida localmente", async () => {
    await saveInspection(storedInspection);

    await expect(getInspection(inspection.id)).resolves.toEqual(storedInspection);
  });

  it("conserva la inspección después de cerrar y volver a abrir el adaptador", async () => {
    const firstConnection = await openStorageDatabase();
    await saveInspection(storedInspection, firstConnection);
    closeStorageDatabase(firstConnection);

    const reopenedConnection = await openStorageDatabase();
    const restored = await getInspection(inspection.id, reopenedConnection);
    closeStorageDatabase(reopenedConnection);

    expect(restored).toEqual(storedInspection);
  });

  it("conserva una operación pendiente al reconstruir el acceso a la base", async () => {
    const firstConnection = await openStorageDatabase();
    await saveOutboxOperation(operation, firstConnection);
    closeStorageDatabase(firstConnection);

    const reopenedConnection = await openStorageDatabase();
    const restored = await getOutboxOperation(operation.operationId, reopenedConnection);
    closeStorageDatabase(reopenedConnection);

    expect(restored).toEqual(operation);
  });

  it("actualiza por id sin duplicar el mismo registro", async () => {
    await saveInspection(storedInspection);
    await saveInspection({ ...storedInspection, summary: "Resumen sintético actualizado." });

    const allInspections = await getAllInspections();
    expect(allInspections).toHaveLength(1);
    expect(allInspections[0].summary).toBe("Resumen sintético actualizado.");
  });

  it("guarda la inspección y su operación en una sola transacción", async () => {
    await saveInspectionWithOperation(storedInspection, operation);

    await expect(getInspection(inspection.id)).resolves.toEqual(storedInspection);
    await expect(getAllOutboxOperations()).resolves.toEqual([operation]);
  });

  it("revierte la inspección si IndexedDB no puede guardar su operación", async () => {
    const uncloneableOperation = {
      ...operation,
      payload: { ...operation.payload, invalidSyntheticValue: () => "no clonable" }
    } as unknown as OutboxOperation;

    await expect(saveInspectionWithOperation(storedInspection, uncloneableOperation)).rejects.toThrow();
    await expect(getInspection(inspection.id)).resolves.toBeUndefined();
    await expect(getAllOutboxOperations()).resolves.toEqual([]);
  });

  it("no almacena nada cuando la operación de la mutación conjunta es inválida", async () => {
    const invalidOperation = { ...operation, entityId: "otra-inspeccion" } as OutboxOperation;

    await expect(saveInspectionWithOperation(storedInspection, invalidOperation)).rejects.toThrow();
    await expect(getInspection(inspection.id)).resolves.toBeUndefined();
    await expect(getAllOutboxOperations()).resolves.toEqual([]);
  });

  it("rechaza datos de inspección inválidos", async () => {
    const invalidInspection = { ...storedInspection, location: "", findings: -1 } as StoredInspection;

    await expect(saveInspection(invalidInspection)).rejects.toThrow(TypeError);
    await expect(getAllInspections()).resolves.toEqual([]);
  });
});
