import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteStorageDatabase,
  getAllOutboxOperations,
  getInspection,
  getOutboxOperation,
  saveInspection,
  saveOutboxOperation
} from "@/lib/storage/indexeddb";
import { applyMutation, countServerRecords, getServerRecord, resetServerStore } from "@/lib/sync/api-store";
import { getConflict, listConflicts } from "@/lib/sync/conflict-policy";
import { enqueue, processQueue, recoverInterruptedOperations } from "@/lib/sync/queue";
import type { SendFn } from "@/lib/sync/client";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";

/**
 * Capa de integración: cola real + IndexedDB real (fake-indexeddb) + receptor real en memoria
 * (`applyMutation`). No se simula la respuesta del servidor: el defecto que esta capa debe detectar
 * vive en la guarda de idempotencia del receptor. Todos los datos son sintéticos.
 */

const createInspection = (id: string, location: string, findings = 1): Inspection => ({
  id,
  location,
  date: "2026-10-21",
  inspector: "Técnico Sintético",
  status: "attention",
  statusLabel: "Requiere atención",
  findings,
  summary: "Resumen sintético para la prueba de sincronización."
});

const createOperation = (
  inspection: Inspection,
  operationId: string,
  overrides: Partial<OutboxOperation> = {}
): OutboxOperation => ({
  operationId,
  entityId: inspection.id,
  type: "create",
  payload: inspection,
  baseRevision: null,
  attempts: 0,
  status: "pending",
  createdAt: "2026-10-21T10:00:00.000Z",
  updatedAt: "2026-10-21T10:00:00.000Z",
  ...overrides
});

const createStored = (inspection: Inspection, operationId: string): StoredInspection => ({
  ...inspection,
  sync: { status: "pending", baseRevision: null, pendingOperationId: operationId }
});

const toMutation = (operation: OutboxOperation) => ({
  operationId: operation.operationId,
  entityId: operation.entityId,
  type: operation.type,
  payload: operation.payload,
  baseRevision: operation.baseRevision
});

/** Envío real contra el receptor en memoria, con la misma traducción que usa el cliente HTTP. */
const serverSend: SendFn = async (operation) => {
  const response = applyMutation(toMutation(operation), operation.operationId);
  if (response.status === 200) {
    return {
      kind: "ok",
      revision: response.body.revision as number,
      inspection: response.body.inspection as Inspection
    };
  }
  if (response.status === 409) return { kind: "conflict", remote: response.body.remote as never };
  return { kind: "rejected", error: `HTTP ${response.status}` };
};

const noSleep = async () => undefined;

describe("integración: sincronización idempotente contra el receptor real", () => {
  beforeEach(async () => {
    await deleteStorageDatabase();
    resetServerStore();
  });

  afterEach(async () => {
    await deleteStorageDatabase();
    resetServerStore();
  });

  it("reintenta tras perder la respuesta con el mismo operationId y no duplica el registro", async () => {
    const inspection = createInspection("insp-dup-1", "Laboratorio Sintético Duplicado");
    const operation = createOperation(inspection, "op-dup-1");
    await saveInspection(createStored(inspection, operation.operationId));
    await enqueue(operation);

    const sentOperationIds: string[] = [];
    const waits: number[] = [];
    // El servidor aplica la mutación, pero la respuesta se pierde en la primera entrega.
    const lossyOnce: SendFn = async (op) => {
      sentOperationIds.push(op.operationId);
      const result = await serverSend(op);
      return sentOperationIds.length === 1 ? { kind: "retryable", error: "Respuesta perdida" } : result;
    };

    const summary = await processQueue({
      send: lossyOnce,
      sleep: async (ms) => {
        waits.push(ms);
      }
    });

    expect(sentOperationIds).toEqual(["op-dup-1", "op-dup-1"]);
    expect(waits).toEqual([1000]);
    expect(summary).toMatchObject({ done: ["op-dup-1"], failed: [], conflicts: [], retries: 1 });
    expect(countServerRecords()).toBe(1);
    expect(getServerRecord(inspection.id)?.revision).toBe(1);
    expect(await getOutboxOperation("op-dup-1")).toMatchObject({ status: "done", attempts: 2 });
    expect((await getInspection(inspection.id))?.sync).toMatchObject({ status: "done", baseRevision: 1 });
  });

  it("la misma clave de idempotencia devuelve exactamente la misma respuesta sin avanzar la revisión", () => {
    const inspection = createInspection("insp-dup-2", "Laboratorio Sintético Misma Clave");
    const mutation = toMutation(createOperation(inspection, "op-dup-2"));

    const first = applyMutation(mutation, "op-dup-2");
    const repeated = applyMutation(mutation, "op-dup-2");

    expect(first.status).toBe(200);
    expect(repeated).toEqual(first);
    expect(repeated.body.revision).toBe(1);
    expect(getServerRecord(inspection.id)?.revision).toBe(1);
    expect(countServerRecords()).toBe(1);
  });

  it("distingue un reintento de una operación nueva: otro operationId sí avanza la revisión", () => {
    const inspection = createInspection("insp-dup-3", "Laboratorio Sintético Operación Nueva");
    applyMutation(toMutation(createOperation(inspection, "op-dup-3a")), "op-dup-3a");

    const update = createOperation({ ...inspection, findings: 7 }, "op-dup-3b", { type: "update", baseRevision: 1 });
    const response = applyMutation(toMutation(update), "op-dup-3b");

    expect(response.status).toBe(200);
    expect(response.body.revision).toBe(2);
    expect(countServerRecords()).toBe(1);
    expect(getServerRecord(inspection.id)?.inspection.findings).toBe(7);
  });

  it("registra el conflicto de la segunda operación, no crea otro registro y deja avanzar otra inspección", async () => {
    const target = createInspection("insp-conf-1", "Laboratorio Sintético Conflicto");
    const independent = createInspection("insp-conf-2", "Laboratorio Sintético Independiente");

    const first = createOperation(target, "op-conf-A", { createdAt: "2026-10-21T10:00:00.000Z" });
    const second = createOperation({ ...target, findings: 4 }, "op-conf-B", {
      type: "update",
      baseRevision: 1,
      createdAt: "2026-10-21T10:01:00.000Z"
    });
    const third = createOperation(independent, "op-conf-C", { createdAt: "2026-10-21T10:02:00.000Z" });

    await saveInspection(createStored({ ...target, findings: 4 }, second.operationId));
    await saveInspection(createStored(independent, third.operationId));
    await enqueue(first);
    await enqueue(second);
    await enqueue(third);

    // Otro dispositivo modifica la misma inspección justo antes de enviar la operación B.
    let remoteApplied = false;
    const racingSend: SendFn = async (operation) => {
      if (operation.operationId === "op-conf-B" && !remoteApplied) {
        remoteApplied = true;
        const remote = createOperation({ ...target, findings: 9, summary: "Cambio remoto sintético." }, "op-remoto-1", {
          type: "update",
          baseRevision: 1
        });
        expect(applyMutation(toMutation(remote), remote.operationId).status).toBe(200);
      }
      return serverSend(operation);
    };

    const summary = await processQueue({ send: racingSend, sleep: noSleep });

    expect(summary.done).toEqual(["op-conf-A", "op-conf-C"]);
    expect(summary.conflicts).toEqual(["op-conf-B"]);
    expect(summary.failed).toEqual([]);

    // Un solo registro por inspección y la versión remota no se pisa.
    expect(countServerRecords()).toBe(2);
    expect(getServerRecord(target.id)?.revision).toBe(2);
    expect(getServerRecord(target.id)?.inspection.findings).toBe(9);

    // La operación queda bloqueada con ambas versiones disponibles; la otra inspección sí sincronizó.
    expect(await getOutboxOperation("op-conf-B")).toMatchObject({ status: "conflict" });
    expect(await getOutboxOperation("op-conf-C")).toMatchObject({ status: "done" });
    expect((await getInspection(target.id))?.sync.status).toBe("conflict");
    expect((await getInspection(independent.id))?.sync.status).toBe("done");
    expect(await listConflicts()).toHaveLength(1);
    expect(await getConflict(target.id)).toMatchObject({ remoteRevision: 2, operationId: "op-conf-B" });
  });

  it("recupera una operación interrumpida conservando su operationId y la envía una sola vez", async () => {
    const inspection = createInspection("insp-rec-1", "Laboratorio Sintético Recuperación");
    const interrupted = createOperation(inspection, "op-rec-1", { status: "inFlight", attempts: 1 });
    await saveInspection(createStored(inspection, interrupted.operationId));
    await saveOutboxOperation(interrupted);

    const recovered = await recoverInterruptedOperations();

    expect(recovered).toEqual(["op-rec-1"]);
    expect(await getOutboxOperation("op-rec-1")).toMatchObject({ status: "pending", attempts: 1, operationId: "op-rec-1" });

    const summary = await processQueue({ send: serverSend, sleep: noSleep });

    expect(summary.done).toEqual(["op-rec-1"]);
    expect(countServerRecords()).toBe(1);
    expect(getServerRecord(inspection.id)?.revision).toBe(1);
    expect(await getAllOutboxOperations()).toHaveLength(1);
  });
});
