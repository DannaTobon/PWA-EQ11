import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeStorageDatabase,
  deleteStorageDatabase,
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  openStorageDatabase,
  saveInspectionWithOperation,
  saveOutboxOperation
} from "@/lib/storage/indexeddb";
import {
  getConflict,
  hasRevisionConflict,
  listConflicts,
  registerConflict,
  resolveConflict,
  selectRunnableOperations
} from "@/lib/sync/conflict-policy";
import { applyMutation, countServerRecords, getServerRecord, resetServerStore } from "@/lib/sync/api-store";
import type { SendFn } from "@/lib/sync/client";
import { applyServerConfirmation, processQueue } from "@/lib/sync/queue";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";

const NOW = "2026-10-05T12:00:00.000Z";
const now = () => NOW;

function makeInspection(id: string, overrides: Partial<Inspection> = {}): Inspection {
  return {
    id,
    location: "Laboratorio Sintético",
    date: "2026-10-05",
    inspector: "Técnica Sintética",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Resumen sintético local.",
    ...overrides
  };
}

function makeOperation(operationId: string, payload: Inspection, overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId,
    entityId: payload.id,
    type: "update",
    payload,
    baseRevision: 7,
    attempts: 0,
    status: "pending",
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
    ...overrides
  };
}

function makeStored(payload: Inspection, operationId: string, baseRevision: number | null = 7): StoredInspection {
  return { ...payload, sync: { status: "pending", baseRevision, pendingOperationId: operationId } };
}

const sendToServer: SendFn = async (op) => {
  const r = applyMutation({ ...op }, op.operationId);
  if (r.status === 200) return { kind: "ok", revision: r.body.revision as number, inspection: r.body.inspection as Inspection };
  if (r.status === 409) return { kind: "conflict", remote: r.body.remote as never };
  return { kind: "rejected", error: `HTTP ${r.status}` };
};

const localA = makeInspection("insp-A", { status: "attention", statusLabel: "Requiere atención", findings: 2, summary: "Versión LOCAL." });
const remoteA = makeInspection("insp-A", { status: "ok", statusLabel: "Sin incidencias", findings: 0, summary: "Versión REMOTA." });

async function seedConflict() {
  const op = makeOperation("op-A1", localA, { status: "inFlight", attempts: 1 });
  await saveInspectionWithOperation(makeStored(localA, op.operationId), op);
  await registerConflict(op.operationId, { inspection: remoteA, revision: 8 }, { now });
  return op;
}

describe("sincronización: conflictos y recuperación", () => {
  beforeEach(async () => {
    await deleteStorageDatabase();
    resetServerStore();
  });
  afterEach(async () => {
    await deleteStorageDatabase();
  });

  it("1. captura offline y recuperación después de recargar", async () => {
    const op = makeOperation("op-offline", localA, { baseRevision: null, type: "create" });

    const first = await openStorageDatabase();
    await saveInspectionWithOperation(makeStored(localA, op.operationId, null), op, first);
    closeStorageDatabase(first); // simula cerrar la pestaña

    const reopened = await openStorageDatabase(); // simula recargar
    const restored = await getInspection(localA.id, reopened);
    const operations = await getAllOutboxOperations(reopened);
    closeStorageDatabase(reopened);

    expect(restored?.sync.status).toBe("pending");
    expect(restored?.summary).toBe("Versión LOCAL.");
    expect(operations).toEqual([op]);
  });

  it("detecta conflicto solo cuando la revisión base no coincide con la remota", () => {
    expect(hasRevisionConflict(7, 8)).toBe(true);
    expect(hasRevisionConflict(7, 7)).toBe(false);
    expect(hasRevisionConflict(null, null)).toBe(false);
    expect(hasRevisionConflict(null, 1)).toBe(true);
  });

  it("no registra conflicto si las revisiones coinciden", async () => {
    const op = makeOperation("op-ok", localA);
    await saveInspectionWithOperation(makeStored(localA, op.operationId), op);

    await expect(registerConflict(op.operationId, { inspection: remoteA, revision: 7 })).rejects.toThrow(/no hay conflicto/);
    await expect(getOutboxOperation(op.operationId)).resolves.toMatchObject({ status: "pending" });
  });

  it("3. conflicto entre dos revisiones conserva ambas versiones y detiene los reintentos", async () => {
    await seedConflict();

    const operation = await getOutboxOperation("op-A1");
    const conflict = await getConflict("insp-A");
    const stored = await getInspection("insp-A");

    expect(operation?.status).toBe("conflict");
    expect(operation?.lastError).toMatch(/Conflicto/);
    expect(conflict?.local.summary).toBe("Versión LOCAL.");
    expect(conflict?.remote.summary).toBe("Versión REMOTA.");
    expect(conflict).toMatchObject({ baseRevision: 7, remoteRevision: 8, operationId: "op-A1" });
    expect(stored?.summary).toBe("Versión LOCAL."); // la versión local no se sobrescribe
    expect(stored?.sync.status).toBe("conflict");
    expect(selectRunnableOperations(await getAllOutboxOperations())).toEqual([]); // no se reintenta
    await expect(listConflicts()).resolves.toHaveLength(1);
  });

  it("4. bloquea la siguiente operación de la misma inspección hasta resolver el conflicto", async () => {
    await seedConflict();
    const next = makeOperation("op-A2", { ...localA, summary: "Segundo cambio local." }, { createdAt: "2026-10-05T10:05:00.000Z" });
    await saveOutboxOperation(next);

    expect(selectRunnableOperations(await getAllOutboxOperations())).toEqual([]);

    await resolveConflict("insp-A", "keepLocal", { now });
    const runnable = selectRunnableOperations(await getAllOutboxOperations());
    expect(runnable.map((operation) => operation.operationId)).toEqual(["op-A1:keepLocal:r8", "op-A2"]);
  });

  it("5. continúa una operación perteneciente a otra inspección", async () => {
    await seedConflict();
    const other = makeInspection("insp-B");
    const otherOp = makeOperation("op-B1", other, { baseRevision: 3, createdAt: "2026-10-05T10:10:00.000Z" });
    await saveInspectionWithOperation(makeStored(other, otherOp.operationId, 3), otherOp);

    const runnable = selectRunnableOperations(await getAllOutboxOperations());
    expect(runnable.map((operation) => operation.operationId)).toEqual(["op-B1"]);
  });

  it("acceptServer: actualiza el registro local, cierra el conflicto y no crea otra mutación", async () => {
    await seedConflict();
    const waiting = makeOperation("op-A2", { ...localA, summary: "Cambio sobre versión rechazada." }, { createdAt: "2026-10-05T10:05:00.000Z" });
    await saveOutboxOperation(waiting);

    const result = await resolveConflict("insp-A", "acceptServer", { now });
    const stored = await getInspection("insp-A");
    const operations = await getAllOutboxOperations();

    expect(result.newOperation).toBeUndefined();
    expect(result.discardedOperationIds).toEqual(["op-A2"]);
    expect(stored).toMatchObject({ summary: "Versión REMOTA.", sync: { status: "done", baseRevision: 8 } });
    expect(operations).toHaveLength(2); // ninguna operación nueva
    expect(operations.find((op) => op.operationId === "op-A1")?.status).toBe("done");
    expect(operations.find((op) => op.operationId === "op-A2")).toMatchObject({ status: "failed", payload: waiting.payload });
    expect(selectRunnableOperations(operations)).toEqual([]); // nada se envía
    await expect(getConflict("insp-A")).resolves.toBeUndefined();
  });

  it("keepLocal: crea una operación con nuevo operationId basada en la revisión vigente", async () => {
    await seedConflict();
    const waiting = makeOperation("op-A2", { ...localA, summary: "Segundo cambio local." }, { createdAt: "2026-10-05T10:05:00.000Z" });
    await saveOutboxOperation(waiting);

    const result = await resolveConflict("insp-A", "keepLocal", { now });
    const operations = await getAllOutboxOperations();
    const created = result.newOperation!;

    expect(created.operationId).not.toBe("op-A1");
    expect(created).toMatchObject({ entityId: "insp-A", baseRevision: 8, status: "pending", attempts: 0 });
    expect(created.payload.summary).toBe("Versión LOCAL.");
    expect(operations.find((op) => op.operationId === "op-A1")?.status).toBe("done");
    expect(result.resumedOperationIds).toEqual(["op-A2"]);
    expect(operations.find((op) => op.operationId === "op-A2")).toMatchObject({ status: "pending", baseRevision: 8 });
    expect((await getInspection("insp-A"))?.sync).toMatchObject({ status: "pending", baseRevision: 8, pendingOperationId: "op-A2" });
    await expect(getConflict("insp-A")).resolves.toBeUndefined();
  });

  it("keepLocal usa la revisión más reciente si se consulta de nuevo al servidor", async () => {
    await seedConflict();
    const fresher = { inspection: makeInspection("insp-A", { summary: "Revisión 9." }), revision: 9 };

    const result = await resolveConflict("insp-A", "keepLocal", { now, remote: fresher });
    expect(result.newOperation?.baseRevision).toBe(9);
  });

  it("rechaza resolver una inspección sin conflicto abierto o con una decisión inválida", async () => {
    await expect(resolveConflict("insp-A", "keepLocal")).rejects.toThrow(/no tiene un conflicto abierto/);
    await seedConflict();
    await expect(resolveConflict("insp-A", "merge" as never)).rejects.toThrow(TypeError);
    await resolveConflict("insp-A", "acceptServer", { now });
    await expect(resolveConflict("insp-A", "acceptServer")).rejects.toThrow(/no tiene un conflicto abierto/);
  });

  it("7. el conflicto y el bloqueo sobreviven al cerrar y reabrir la aplicación", async () => {
    await seedConflict();
    await saveOutboxOperation(makeOperation("op-A2", localA, { createdAt: "2026-10-05T10:05:00.000Z" }));

    const reopened = await openStorageDatabase(); // simula reinicio
    const conflict = await getConflict("insp-A", reopened);
    const operations = await getAllOutboxOperations(reopened);
    closeStorageDatabase(reopened);

    expect(conflict?.remote.summary).toBe("Versión REMOTA.");
    expect(operations.find((op) => op.operationId === "op-A1")?.status).toBe("conflict");
    expect(selectRunnableOperations(operations)).toEqual([]);
  });

  it("2. reintento con el mismo operationId no duplica la inspección", async () => {
    const op = makeOperation("op-retry", localA, { baseRevision: null, type: "create" });
    await saveInspectionWithOperation(makeStored(localA, op.operationId, null), op);
    let lostResponse = true;
    const seenIds: string[] = [];
    const send: SendFn = async (operation) => {
      seenIds.push(operation.operationId);
      const r = applyMutation({ ...operation }, operation.operationId); // el servidor sí procesa
      if (lostResponse) { lostResponse = false; return { kind: "retryable", error: "respuesta perdida" }; }
      return { kind: "ok", revision: r.body.revision as number, inspection: r.body.inspection as Inspection };
    };

    await processQueue({ send, sleep: async () => undefined });

    expect(seenIds).toEqual(["op-retry", "op-retry"]);
    expect(countServerRecords()).toBe(1);
    expect(getServerRecord("insp-A")?.revision).toBe(1);
    expect(await getOutboxOperation("op-retry")).toMatchObject({ status: "done", attempts: 2 });
    expect((await getInspection("insp-A"))?.sync).toMatchObject({ status: "done", baseRevision: 1 });
  });

  it("6. una respuesta antigua recibida después de una nueva no reemplaza la revisión actual", async () => {
    const first = makeOperation("op-1", localA, { baseRevision: null, type: "create" });
    await saveInspectionWithOperation(makeStored(localA, first.operationId, null), first);
    const second = makeOperation("op-2", { ...localA, summary: "Segundo cambio." }, { baseRevision: 1, createdAt: "2026-10-05T10:05:00.000Z" });
    await saveInspectionWithOperation(makeStored(second.payload, second.operationId, 1), second);

    await expect(applyServerConfirmation(second, 2)).resolves.toBe("applied"); // llega primero la nueva
    await expect(applyServerConfirmation(first, 1)).resolves.toBe("stale"); // llega después la antigua

    const stored = await getInspection("insp-A");
    expect(stored?.sync).toMatchObject({ status: "done", baseRevision: 2 });
    expect(stored?.summary).toBe("Segundo cambio.");
  });

  it("7. una operación inFlight interrumpida se recupera y se envía al reabrir la cola", async () => {
    const op = makeOperation("op-fly", localA, { baseRevision: null, type: "create", status: "inFlight", attempts: 1 });
    await saveInspectionWithOperation(makeStored(localA, op.operationId, null), op);

    const summary = await processQueue({ send: sendToServer, sleep: async () => undefined });

    expect(summary.done).toEqual(["op-fly"]);
    expect(await getOutboxOperation("op-fly")).toMatchObject({ status: "done", attempts: 2 });
    expect(countServerRecords()).toBe(1);
  });

  it("integración: un 409 real detiene esa inspección y la cola sigue con otra", async () => {
    // Otro cliente dejó la inspección A en la revisión 8 del servidor.
    applyMutation({ operationId: "otro-cliente", entityId: "insp-A", type: "create", payload: remoteA, baseRevision: null });
    for (let i = 0; i < 7; i++) {
      applyMutation({ operationId: `otro-${i}`, entityId: "insp-A", type: "update", payload: remoteA, baseRevision: i + 1 });
    }
    const opA = makeOperation("op-A1", localA, { baseRevision: 7 });
    await saveInspectionWithOperation(makeStored(localA, opA.operationId), opA);
    const nextA = makeOperation("op-A2", { ...localA, summary: "Cambio posterior." }, { baseRevision: 7, createdAt: "2026-10-05T10:05:00.000Z" });
    await saveOutboxOperation(nextA);
    const other = makeInspection("insp-B");
    const opB = makeOperation("op-B1", other, { baseRevision: null, type: "create", createdAt: "2026-10-05T10:10:00.000Z" });
    await saveInspectionWithOperation(makeStored(other, opB.operationId, null), opB);

    const summary = await processQueue({ send: sendToServer, sleep: async () => undefined });

    expect(summary).toMatchObject({ conflicts: ["op-A1"], done: ["op-B1"] });
    expect((await getOutboxOperation("op-A2"))?.status).toBe("pending"); // espera
    expect((await getConflict("insp-A"))?.remote.summary).toBe("Versión REMOTA.");
    expect(getServerRecord("insp-B")?.revision).toBe(1);

    await resolveConflict("insp-A", "keepLocal", { now });
    const after = await processQueue({ send: sendToServer, sleep: async () => undefined });
    expect(after.done).toEqual(["op-A1:keepLocal:r8", "op-A2"]);
    expect(getServerRecord("insp-A")?.revision).toBe(10);
  });
});
