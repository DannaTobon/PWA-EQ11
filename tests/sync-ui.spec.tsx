import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InspectionConflictReview } from "@/components/inspection-conflict-review";
import { useInspectionSync } from "@/lib/sync/use-inspection-sync";
import type { ConflictRecord } from "@/lib/sync/conflict-policy";

const mocks = vi.hoisted(() => ({
  getAllInspections: vi.fn(),
  getAllOutboxOperations: vi.fn(),
  getPendingOperations: vi.fn(),
  processQueue: vi.fn(),
  retryFailedOperation: vi.fn(),
  listConflicts: vi.fn(),
  resolveConflict: vi.fn(),
  createHttpSender: vi.fn()
}));

vi.mock("@/lib/storage/indexeddb", () => ({
  getAllInspections: mocks.getAllInspections,
  getAllOutboxOperations: mocks.getAllOutboxOperations
}));

vi.mock("@/lib/sync/queue", () => ({
  getPendingOperations: mocks.getPendingOperations,
  processQueue: mocks.processQueue,
  retryFailedOperation: mocks.retryFailedOperation
}));

vi.mock("@/lib/sync/conflict-policy", () => ({
  listConflicts: mocks.listConflicts,
  resolveConflict: mocks.resolveConflict
}));

vi.mock("@/lib/sync/client", () => ({
  createHttpSender: mocks.createHttpSender
}));

const local = {
  id: "insp-conflict",
  location: "Laboratorio local",
  date: "2026-10-05",
  inspector: "Persona sintética",
  status: "attention" as const,
  statusLabel: "Requiere atención",
  findings: 2,
  summary: "Versión local sintética."
};

const remote = {
  ...local,
  location: "Laboratorio remoto",
  status: "ok" as const,
  statusLabel: "Sin incidencias",
  findings: 0,
  summary: "Versión remota sintética."
};

const conflict: ConflictRecord = {
  entityId: local.id,
  operationId: "op-conflict",
  baseRevision: 2,
  remoteRevision: 3,
  local,
  remote,
  detectedAt: "2026-10-05T12:00:00.000Z"
};

describe("integración de la cola con el ciclo de vida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllInspections.mockResolvedValue([]);
    mocks.getAllOutboxOperations.mockResolvedValue([]);
    mocks.getPendingOperations.mockResolvedValue([]);
    mocks.processQueue.mockResolvedValue({ done: [], failed: [], conflicts: [], retries: 0 });
    mocks.retryFailedOperation.mockResolvedValue(undefined);
    mocks.listConflicts.mockResolvedValue([]);
    mocks.resolveConflict.mockResolvedValue(undefined);
    mocks.createHttpSender.mockReturnValue(vi.fn());
  });

  it("procesa las operaciones pendientes al iniciar", async () => {
    renderHook(() => useInspectionSync());
    await waitFor(() => expect(mocks.processQueue).toHaveBeenCalledTimes(1));
  });

  it("vuelve a procesar al recibir el evento online", async () => {
    renderHook(() => useInspectionSync());
    await waitFor(() => expect(mocks.processQueue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.getAllInspections).toHaveBeenCalledTimes(1));

    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(mocks.processQueue).toHaveBeenCalledTimes(2));
  });

  it("elimina el listener online al desmontar", async () => {
    const { unmount } = renderHook(() => useInspectionSync());
    await waitFor(() => expect(mocks.processQueue).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.getAllInspections).toHaveBeenCalledTimes(1));
    unmount();

    act(() => window.dispatchEvent(new Event("online")));

    expect(mocks.processQueue).toHaveBeenCalledTimes(1);
  });

  it("reutiliza el procesamiento activo y evita ejecuciones concurrentes", async () => {
    let finish!: () => void;
    mocks.processQueue.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    renderHook(() => useInspectionSync());
    await waitFor(() => expect(mocks.processQueue).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    expect(mocks.processQueue).toHaveBeenCalledTimes(1);

    await act(async () => finish());
  });

  it("el reintento manual conserva el operationId y vuelve a ejecutar la cola", async () => {
    const { result } = renderHook(() => useInspectionSync());
    await waitFor(() => expect(result.current.isSynchronizing).toBe(false));

    await act(async () => result.current.retry("op-failed"));

    expect(mocks.retryFailedOperation).toHaveBeenCalledWith("op-failed");
    expect(mocks.processQueue).toHaveBeenCalledTimes(2);
  });
});

describe("revisión manual de conflictos", () => {
  it("presenta las versiones local y remota", () => {
    render(<InspectionConflictReview conflict={conflict} onResolve={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Revisión requerida/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Versión local" })).toHaveTextContent("Versión local sintética.");
    expect(screen.getByRole("region", { name: "Versión remota" })).toHaveTextContent("Versión remota sintética.");
  });

  it("permite aceptar la versión del servidor", () => {
    const onResolve = vi.fn();
    render(<InspectionConflictReview conflict={conflict} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceptar versión del servidor" }));

    expect(onResolve).toHaveBeenCalledWith(conflict.entityId, "acceptServer");
  });

  it("permite conservar la versión local", () => {
    const onResolve = vi.fn();
    render(<InspectionConflictReview conflict={conflict} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole("button", { name: "Conservar versión local" }));

    expect(onResolve).toHaveBeenCalledWith(conflict.entityId, "keepLocal");
  });
});
