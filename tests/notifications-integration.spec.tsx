import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enableLocalNotifications: vi.fn(),
  showLocalNotification: vi.fn(),
  saveInspectionWithOperation: vi.fn(),
  refresh: vi.fn(),
  synchronize: vi.fn(),
  retry: vi.fn(),
  resolve: vi.fn()
}));

vi.mock("@/lib/notifications/client", () => ({
  enableLocalNotifications: mocks.enableLocalNotifications,
  showLocalNotification: mocks.showLocalNotification
}));

vi.mock("@/lib/storage/indexeddb", () => ({
  saveInspectionWithOperation: mocks.saveInspectionWithOperation
}));

vi.mock("@/lib/sync/use-inspection-sync", () => ({
  useInspectionSync: () => ({
    inspections: [],
    operations: [],
    conflicts: [],
    syncingEntityIds: new Set<string>(),
    isSynchronizing: false,
    syncError: null,
    refresh: mocks.refresh,
    synchronize: mocks.synchronize,
    retry: mocks.retry,
    resolve: mocks.resolve
  })
}));

import InspeccionesPage from "@/app/inspecciones/page";

function renderPage() {
  return render(<InspeccionesPage />);
}

function saveInspection(): void {
  fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("inspection-id").mockReturnValueOnce("operation-id") });
  mocks.enableLocalNotifications.mockResolvedValue({ status: "success", data: "granted" });
  mocks.showLocalNotification.mockResolvedValue({
    status: "success",
    data: { channel: "service-worker", shownAt: "2026-10-10T12:00:00.000Z" }
  });
  mocks.saveInspectionWithOperation.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("integración de notificaciones en /inspecciones", () => {
  it("no solicita permiso durante montaje y lo hace solo desde el botón", async () => {
    renderPage();

    expect(mocks.enableLocalNotifications).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Habilitar notificaciones" }));

    await waitFor(() => expect(mocks.enableLocalNotifications).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Notificaciones locales habilitadas.")).toBeInTheDocument();
  });

  it("notifica una vez después de un guardado local exitoso", async () => {
    renderPage();

    saveInspection();

    await waitFor(() => expect(mocks.saveInspectionWithOperation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.showLocalNotification).toHaveBeenCalledTimes(1));
    expect(mocks.showLocalNotification).toHaveBeenCalledWith({
      title: "Inspección guardada",
      body: "La inspección se guardó en este dispositivo.",
      tag: "inspection-saved"
    });
    expect(screen.getByText("Inspección guardada localmente. Queda pendiente de sincronización.")).toHaveAttribute(
      "role",
      "status"
    );
  });

  it("no notifica cuando falla el guardado principal", async () => {
    mocks.saveInspectionWithOperation.mockRejectedValueOnce(new Error("fallo sintético de almacenamiento"));
    renderPage();

    saveInspection();

    expect(await screen.findByText(/No se pudo guardar la inspección local/)).toBeInTheDocument();
    expect(mocks.showLocalNotification).not.toHaveBeenCalled();
  });

  it("conserva la confirmación si la notificación falla", async () => {
    mocks.showLocalNotification.mockRejectedValueOnce(new Error("fallo sintético de notificación"));
    renderPage();

    saveInspection();

    expect(await screen.findByText("Inspección guardada localmente. Queda pendiente de sincronización.")).toBeInTheDocument();
    expect(mocks.saveInspectionWithOperation).toHaveBeenCalledTimes(1);
    expect(mocks.showLocalNotification).toHaveBeenCalledTimes(1);
  });

  it("no mantiene bloqueado el formulario mientras espera la notificación", async () => {
    mocks.showLocalNotification.mockReturnValueOnce(new Promise(() => {}));
    renderPage();

    saveInspection();

    expect(await screen.findByText("Inspección guardada localmente. Queda pendiente de sincronización.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar sin conexión" })).toBeEnabled());
  });

  it("rerenderizar después del guardado no genera otra notificación", async () => {
    const view = renderPage();
    saveInspection();
    await waitFor(() => expect(mocks.showLocalNotification).toHaveBeenCalledTimes(1));

    view.rerender(<InspeccionesPage />);

    expect(mocks.showLocalNotification).toHaveBeenCalledTimes(1);
  });
});
