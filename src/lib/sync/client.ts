import type { OutboxOperation } from "@/lib/storage/schema";
import type { Inspection } from "@/lib/data/inspections";
import type { ServerSnapshot } from "@/lib/sync/conflict-policy";

export type SendResult =
  | { kind: "ok"; revision: number; inspection: Inspection }
  | { kind: "conflict"; remote: ServerSnapshot }
  | { kind: "retryable"; error: string }
  | { kind: "rejected"; error: string };

export type SendFn = (operation: OutboxOperation) => Promise<SendResult>;

/** Reintentables: 408, 429 y 5xx. 409 = conflicto. Otros 4xx = fallo definitivo. */
export function classifyHttpStatus(status: number): "ok" | "retryable" | "conflict" | "rejected" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 409) return "conflict";
  if (status === 408 || status === 429 || status >= 500) return "retryable";
  return "rejected";
}

/** Envía la operación con el mismo operationId como clave de idempotencia en cada reintento. */
export function createHttpSender(fetchImpl: typeof fetch = (...args) => fetch(...args), url = "/api/inspecciones"): SendFn {
  return async (operation) => {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": operation.operationId },
        body: JSON.stringify({
          operationId: operation.operationId,
          entityId: operation.entityId,
          type: operation.type,
          payload: operation.payload,
          baseRevision: operation.baseRevision
        })
      });
    } catch (error) {
      return { kind: "retryable", error: error instanceof Error ? error.message : "Error de red" };
    }

    const kind = classifyHttpStatus(response.status);
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (kind === "ok") return { kind, revision: body.revision as number, inspection: body.inspection as Inspection };
    if (kind === "conflict") return { kind, remote: body.remote as ServerSnapshot };
    return { kind, error: `HTTP ${response.status}` };
  };
}
