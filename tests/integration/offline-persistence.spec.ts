import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeStorageDatabase,
  deleteStorageDatabase,
  getAllInspections,
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  openStorageDatabase,
  saveInspection,
  saveInspectionWithOperation
} from "@/lib/storage/indexeddb";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";

/**
 * Capa de integración: IndexedDB real (fake-indexeddb) + funciones reales de almacenamiento.
 * Riesgo cubierto: una inspección capturada sin conexión debe sobrevivir al cierre/reapertura
 * de la base y nunca debe quedar a medias (inspección sin operación o al revés).
 * Todos los datos son sintéticos.
 */

const createInspection = (id: string, location: string): Inspection => ({
  id,
  location,
  date: "2026-10-20",
  inspector: "Técnica Sintética",
  status: "attention",
  statusLabel: "Requiere atención",
  findings: 2,
  summary: "Resumen sintético para la prueba de persistencia."
});

const createOperation = (inspection: Inspection, operationId: string): OutboxOperation => ({
  operationId,
  entityId: inspection.id,
  type: "create",
  payload: inspection,
  baseRevision: null,
  attempts: 0,
  status: "pending",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z"
});

const createStored = (inspection: Inspection, operationId: string): StoredInspection => ({
  ...inspection,
  sync: { status: "pending", baseRevision: null, pendingOperationId: operationId }
});

describe("integración: persistencia local sin conexión", () => {
  beforeEach(async () => {
    await deleteStorageDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteStorageDatabase();
  });

  it("conserva la inspección y su operación después de cerrar y reabrir la base", async () => {
    const inspection = createInspection("insp-persist-1", "Laboratorio Sintético Persistencia");
    const operation = createOperation(inspection, "op-persist-1");

    const firstConnection = await openStorageDatabase();
    await saveInspectionWithOperation(createStored(inspection, operation.operationId), operation, firstConnection);
    closeStorageDatabase(firstConnection);

    // Simula recargar la página: se abre una conexión nueva sobre la misma base.
    const secondConnection = await openStorageDatabase();
    try {
      const storedInspection = await getInspection(inspection.id, secondConnection);
      const storedOperation = await getOutboxOperation(operation.operationId, secondConnection);

      expect(storedInspection).toMatchObject({ id: inspection.id, location: inspection.location });
      expect(storedInspection?.sync.status).toBe("pending");
      expect(storedInspection?.sync.pendingOperationId).toBe(operation.operationId);
      expect(storedOperation?.operationId).toBe(operation.operationId);
      expect(storedOperation?.entityId).toBe(inspection.id);
      expect(storedOperation?.status).toBe("pending");
    } finally {
      closeStorageDatabase(secondConnection);
    }
  });

  it("rechaza una operación cuyo payload no coincide con la entidad y no deja nada guardado", async () => {
    const inspection = createInspection("insp-atomic-1", "Laboratorio Sintético Atómico");
    const other = createInspection("insp-atomic-other", "Otro Laboratorio Sintético");
    const mismatched: OutboxOperation = { ...createOperation(inspection, "op-atomic-1"), payload: other };

    await expect(
      saveInspectionWithOperation(createStored(inspection, mismatched.operationId), mismatched)
    ).rejects.toThrow();

    expect(await getAllInspections()).toHaveLength(0);
    expect(await getAllOutboxOperations()).toHaveLength(0);
  });

  it("rechaza una inspección cuya operación pendiente no es la que se guarda", async () => {
    const inspection = createInspection("insp-atomic-2", "Laboratorio Sintético Atómico 2");
    const operation = createOperation(inspection, "op-atomic-2");

    await expect(
      saveInspectionWithOperation(createStored(inspection, "otra-operacion"), operation)
    ).rejects.toThrow(TypeError);

    expect(await getAllInspections()).toHaveLength(0);
    expect(await getAllOutboxOperations()).toHaveLength(0);
  });

  it("revierte la inspección si falla la escritura de la operación dentro de la misma transacción", async () => {
    const inspection = createInspection("insp-atomic-3", "Laboratorio Sintético Transacción");
    const operation = createOperation(inspection, "op-atomic-3");

    // Falla real a mitad de la transacción: la inspección ya se escribió, el outbox no.
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "outbox") throw new Error("Fallo simulado al escribir el outbox.");
      return originalPut.apply(this, args);
    });

    await expect(
      saveInspectionWithOperation(createStored(inspection, operation.operationId), operation)
    ).rejects.toThrow("Fallo simulado al escribir el outbox.");

    vi.restoreAllMocks();
    expect(await getAllInspections()).toHaveLength(0);
    expect(await getAllOutboxOperations()).toHaveLength(0);
  });

  it("no mezcla dos inspecciones: cada una conserva su propia operación", async () => {
    const first = createInspection("insp-iso-1", "Laboratorio Sintético Uno");
    const second = createInspection("insp-iso-2", "Laboratorio Sintético Dos");
    const firstOperation = createOperation(first, "op-iso-1");
    const secondOperation = createOperation(second, "op-iso-2");

    await saveInspectionWithOperation(createStored(first, firstOperation.operationId), firstOperation);
    await saveInspectionWithOperation(createStored(second, secondOperation.operationId), secondOperation);

    expect(await getAllInspections()).toHaveLength(2);
    expect(await getAllOutboxOperations()).toHaveLength(2);
    expect((await getInspection(first.id))?.sync.pendingOperationId).toBe("op-iso-1");
    expect((await getInspection(second.id))?.sync.pendingOperationId).toBe("op-iso-2");
    expect((await getOutboxOperation("op-iso-1"))?.entityId).toBe(first.id);
    expect((await getOutboxOperation("op-iso-2"))?.entityId).toBe(second.id);
  });

  it("actualizar una inspección no borra ni duplica su operación pendiente", async () => {
    const inspection = createInspection("insp-update-1", "Laboratorio Sintético Actualización");
    const operation = createOperation(inspection, "op-update-1");
    await saveInspectionWithOperation(createStored(inspection, operation.operationId), operation);

    await saveInspection({ ...createStored(inspection, operation.operationId), findings: 5 });

    expect(await getAllInspections()).toHaveLength(1);
    expect((await getInspection(inspection.id))?.findings).toBe(5);
    expect(await getAllOutboxOperations()).toHaveLength(1);
  });
});
