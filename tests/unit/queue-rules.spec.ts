import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";
import {
  deleteStorageDatabase,
  getInspection,
  getOutboxOperation,
  saveInspection,
  saveOutboxOperation
} from "@/lib/storage/indexeddb";
import { selectRunnableOperations } from "@/lib/sync/conflict-policy";
import { applyServerConfirmation, backoffDelay, DEFAULT_RETRY_CONFIG } from "@/lib/sync/queue";

// Segunda regla exigida por la actividad: la cola solo envía operaciones
// ejecutables y una confirmación repetida o fuera de orden no duplica ni
// pisa cambios locales más recientes. Los datos son sintéticos.
const inspection: Inspection = {
  id: "local-inspection-queue-001",
  location: "Laboratorio Sintético de Manufactura",
  date: "2026-10-25",
  inspector: "Técnico Sintético Queue",
  status: "attention",
  statusLabel: "Requiere atención",
  findings: 2,
  summary: "Inspección sintética para probar las reglas de la cola."
};

const makeOperation = (operationId: string, overrides: Partial<OutboxOperation> = {}): OutboxOperation => ({
  operationId,
  entityId: inspection.id,
  type: "create",
  payload: inspection,
  baseRevision: null,
  attempts: 0,
  status: "pending",
  createdAt: "2026-10-25T10:00:00.000Z",
  updatedAt: "2026-10-25T10:00:00.000Z",
  ...overrides
});

const stored = (sync: StoredInspection["sync"]): StoredInspection => ({ ...inspection, sync });

describe("regla de selección de la cola", () => {
  it("solo devuelve pendientes, en orden de creación y sin entidades bloqueadas", () => {
    const operations = [
      makeOperation("op-b", { createdAt: "2026-10-25T10:00:02.000Z" }),
      makeOperation("op-a", { createdAt: "2026-10-25T10:00:01.000Z" }),
      makeOperation("op-a2", { createdAt: "2026-10-25T10:00:01.000Z" }),
      makeOperation("op-done", { status: "done" }),
      makeOperation("op-failed", { status: "failed" }),
      makeOperation("op-in-flight", { status: "inFlight" }),
      makeOperation("op-conflict", { entityId: "insp-blocked", status: "conflict" }),
      makeOperation("op-blocked", { entityId: "insp-blocked", status: "pending" }),
      makeOperation("op-other", { entityId: "insp-other", status: "pending" })
    ];

    expect(selectRunnableOperations(operations).map((operation) => operation.operationId)).toEqual([
      "op-other",
      "op-a",
      "op-a2",
      "op-b"
    ]);
  });

  it("devuelve una lista vacía si no hay operaciones o ninguna es ejecutable", () => {
    expect(selectRunnableOperations([])).toEqual([]);
    expect(
      selectRunnableOperations([
        makeOperation("op-done", { status: "done" }),
        makeOperation("op-conflict", { status: "conflict" }),
        makeOperation("op-pending-blocked", { status: "pending", entityId: "insp-blocked" }),
        makeOperation("op-conflict-blocked", { status: "conflict", entityId: "insp-blocked" })
      ])
    ).toEqual([]);
  });
});

describe("regla de espera entre reintentos", () => {
  it.each([
    [1, 1000],
    [2, 2000],
    [3, 4000],
    [4, 4000],
    [0, 1000],
    [-3, 1000]
  ])("para el reintento %i espera %i ms", (retryNumber, expected) => {
    expect(backoffDelay(retryNumber)).toBe(expected);
  });

  it("respeta una configuración distinta de la predeterminada", () => {
    expect(backoffDelay(1, { maxRetries: 1, backoffMs: [250] })).toBe(250);
    expect(DEFAULT_RETRY_CONFIG).toEqual({ maxRetries: 3, backoffMs: [1000, 2000, 4000] });
  });
});

describe("regla de idempotencia al confirmar una sincronización", () => {
  beforeEach(async () => {
    await deleteStorageDatabase();
  });

  afterEach(async () => {
    await deleteStorageDatabase();
  });

  it("no hace nada si la inspección local ya no existe", async () => {
    await expect(applyServerConfirmation(makeOperation("op-missing"), 1)).resolves.toBe("missing");
  });

  it("marca done y guarda la revisión cuando confirma la última operación local", async () => {
    await saveInspection(stored({ status: "pending", baseRevision: null, pendingOperationId: "op-1" }));

    await expect(
      applyServerConfirmation(makeOperation("op-1"), 1, { now: () => "2026-10-25T12:00:00.000Z" })
    ).resolves.toBe("applied");

    expect((await getInspection(inspection.id))?.sync).toEqual({
      status: "done",
      baseRevision: 1,
      lastSyncedAt: "2026-10-25T12:00:00.000Z"
    });
  });

  it("ignora una confirmación repetida o antigua sin modificar el registro", async () => {
    await saveInspection(stored({ status: "done", baseRevision: 5, lastSyncedAt: "2026-10-25T11:00:00.000Z" }));

    await expect(applyServerConfirmation(makeOperation("op-old"), 5)).resolves.toBe("stale");
    await expect(applyServerConfirmation(makeOperation("op-old"), 4)).resolves.toBe("stale");

    expect((await getInspection(inspection.id))?.sync).toEqual({
      status: "done",
      baseRevision: 5,
      lastSyncedAt: "2026-10-25T11:00:00.000Z"
    });
  });

  it("avanza la revisión sin cerrar un cambio local posterior y actualiza su base", async () => {
    await saveInspection(stored({ status: "pending", baseRevision: 1, pendingOperationId: "op-new" }));
    await saveOutboxOperation(makeOperation("op-new", { type: "update", baseRevision: 1 }));

    await expect(
      applyServerConfirmation(makeOperation("op-old", { type: "update", baseRevision: 1 }), 2, {
        now: () => "2026-10-25T12:30:00.000Z"
      })
    ).resolves.toBe("applied");

    expect((await getInspection(inspection.id))?.sync).toEqual({
      status: "pending",
      baseRevision: 2,
      pendingOperationId: "op-new"
    });
    expect((await getOutboxOperation("op-new"))?.baseRevision).toBe(2);
  });
});
