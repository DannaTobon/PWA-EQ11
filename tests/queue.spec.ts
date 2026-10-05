import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteStorageDatabase, getAllOutboxOperations, getInspection, getOutboxOperation, saveInspection, saveOutboxOperation } from "@/lib/storage/indexeddb";
import { applyMutation, countServerRecords, resetServerStore } from "@/lib/sync/api-store";
import { classifyHttpStatus, createHttpSender, type SendFn } from "@/lib/sync/client";
import { applyServerConfirmation, backoffDelay, enqueue, processQueue, recoverInterruptedOperations, retryFailedOperation } from "@/lib/sync/queue";
import type { Inspection } from "@/lib/data/inspections";
import type { OutboxOperation } from "@/lib/storage/schema";

const inspection: Inspection = {
  id: "insp-Q1", location: "Laboratorio Sintético", date: "2026-10-05", inspector: "Técnica Sintética",
  status: "ok", statusLabel: "Sin incidencias", findings: 0, summary: "Resumen sintético."
};
const makeOp = (operationId: string, overrides: Partial<OutboxOperation> = {}): OutboxOperation => ({
  operationId, entityId: inspection.id, type: "create", payload: inspection, baseRevision: null, attempts: 0,
  status: "pending", createdAt: "2026-10-05T10:00:00.000Z", updatedAt: "2026-10-05T10:00:00.000Z", ...overrides
});
const serverSend: SendFn = async (op) => {
  const r = applyMutation({ operationId: op.operationId, entityId: op.entityId, type: op.type, payload: op.payload, baseRevision: op.baseRevision }, op.operationId);
  if (r.status === 200) return { kind: "ok", revision: r.body.revision as number, inspection: r.body.inspection as Inspection };
  if (r.status === 409) return { kind: "conflict", remote: r.body.remote as never };
  return { kind: "rejected", error: `HTTP ${r.status}` };
};
const noSleep = async () => undefined;

describe("cola de sincronización", () => {
  beforeEach(async () => { await deleteStorageDatabase(); resetServerStore(); });
  afterEach(async () => { await deleteStorageDatabase(); });

  it("no agrega dos veces el mismo operationId", async () => {
    expect((await enqueue(makeOp("op-1"))).added).toBe(true);
    expect((await enqueue(makeOp("op-1", { attempts: 5 }))).added).toBe(false);
    const all = await getAllOutboxOperations();
    expect(all).toHaveLength(1);
    expect(all[0].attempts).toBe(0);
  });

  it("un error de red incrementa attempts, conserva la operación y mantiene el operationId", async () => {
    await enqueue(makeOp("op-net"));
    const seen: string[] = [];
    await processQueue({ send: async (op) => { seen.push(op.operationId); return { kind: "retryable", error: "offline" }; }, sleep: noSleep, retry: { maxRetries: 1, backoffMs: [1] } });
    const op = await getOutboxOperation("op-net");
    expect(seen).toEqual(["op-net", "op-net"]);
    expect(op).toMatchObject({ status: "failed", attempts: 2, lastError: "offline" });
  });

  it("usa espera determinista de 1, 2 y 4 s y se detiene tras tres reintentos", async () => {
    await enqueue(makeOp("op-wait"));
    const waits: number[] = [];
    const summary = await processQueue({ send: async () => ({ kind: "retryable", error: "HTTP 503" }), sleep: async (ms) => { waits.push(ms); } });
    expect(waits).toEqual([1000, 2000, 4000]);
    expect(summary).toMatchObject({ failed: ["op-wait"], retries: 3 });
    expect((await getOutboxOperation("op-wait"))?.attempts).toBe(4);
    expect(backoffDelay(9)).toBe(4000);
  });

  it("permite un reintento manual después del límite, con el mismo operationId", async () => {
    await enqueue(makeOp("op-manual"));
    await processQueue({ send: async () => ({ kind: "retryable", error: "HTTP 503" }), sleep: noSleep });
    await retryFailedOperation("op-manual");
    expect(await getOutboxOperation("op-manual")).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("clasifica HTTP: 5xx, 408 y 429 se reintentan; 409 es conflicto; otros 4xx son definitivos", async () => {
    expect([500, 503, 408, 429].map(classifyHttpStatus)).toEqual(["retryable", "retryable", "retryable", "retryable"]);
    expect(classifyHttpStatus(409)).toBe("conflict");
    expect([400, 404, 422].map(classifyHttpStatus)).toEqual(["rejected", "rejected", "rejected"]);
    const sender = createHttpSender(async () => new Response("{}", { status: 400 }));
    await expect(sender(makeOp("op-400"))).resolves.toMatchObject({ kind: "rejected" });
    const failing = createHttpSender(async () => { throw new TypeError("Failed to fetch"); });
    await expect(failing(makeOp("op-off"))).resolves.toMatchObject({ kind: "retryable" });
  });

  it("un 4xx de validación termina en failed sin reintentos", async () => {
    await enqueue(makeOp("op-4xx"));
    const summary = await processQueue({ send: async () => ({ kind: "rejected", error: "HTTP 400" }), sleep: noSleep });
    expect(summary).toMatchObject({ failed: ["op-4xx"], retries: 0 });
    expect((await getOutboxOperation("op-4xx"))?.attempts).toBe(1);
  });

  it("envía la clave de idempotencia igual al operationId", async () => {
    let headers: Record<string, string> = {};
    const sender = createHttpSender(async (_url, init) => { headers = init?.headers as Record<string, string>; return new Response(JSON.stringify({ revision: 1, inspection }), { status: 200 }); });
    await sender(makeOp("op-key"));
    expect(headers["Idempotency-Key"]).toBe("op-key");
  });

  it("la API sintética devuelve el mismo resultado para un operationId repetido", () => {
    const body = { operationId: "op-api", entityId: inspection.id, type: "create", payload: inspection, baseRevision: null };
    const first = applyMutation(body, "op-api");
    const second = applyMutation(body, "op-api");
    expect(second).toEqual(first);
    expect(countServerRecords()).toBe(1);
    expect(applyMutation(body, "otra-clave").status).toBe(400);
    expect(applyMutation({ ...body, operationId: "" }).status).toBe(400);
  });

  it("recupera operaciones inFlight interrumpidas conservando operationId y attempts", async () => {
    await saveOutboxOperation(makeOp("op-fly", { status: "inFlight", attempts: 1 }));
    await expect(recoverInterruptedOperations()).resolves.toEqual(["op-fly"]);
    expect(await getOutboxOperation("op-fly")).toMatchObject({ status: "pending", attempts: 1 });
  });

  it("una confirmación antigua o repetida no sobrescribe una revisión más reciente", async () => {
    const op = makeOp("op-old", { type: "update", baseRevision: 1 });
    await saveInspection({ ...inspection, sync: { status: "done", baseRevision: 5, lastSyncedAt: "2026-10-05T11:00:00.000Z" } });
    await expect(applyServerConfirmation(op, 3)).resolves.toBe("stale");
    await expect(applyServerConfirmation(op, 5)).resolves.toBe("stale");
    expect((await getInspection(inspection.id))?.sync.baseRevision).toBe(5);
  });
});
