import "fake-indexeddb/auto";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteStorageDatabase, getAllInspections, getAllOutboxOperations } from "@/lib/storage/indexeddb";

// Integración transversal de Semana 06 sobre la página real /inspecciones, el cliente real de
// notificaciones y el almacenamiento real (fake-indexeddb). Solo se simula el hook de sincronización
// (red) y las APIs del navegador. Todos los datos son sintéticos; ningún permiso ni dispositivo es real.

vi.mock("@/lib/sync/use-inspection-sync", () => ({
  useInspectionSync: () => ({
    inspections: [],
    operations: [],
    conflicts: [],
    syncingEntityIds: new Set<string>(),
    isSynchronizing: false,
    syncError: null,
    refresh: async () => undefined,
    synchronize: async () => undefined,
    retry: async () => undefined,
    resolve: async () => undefined
  })
}));

import InspeccionesPage from "@/app/inspecciones/page";

const SAVED_MESSAGE = "Inspección guardada localmente. Queda pendiente de sincronización.";

type Env = {
  requestPermission: ReturnType<typeof vi.fn>;
  getCurrentPosition: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
  showNotification: ReturnType<typeof vi.fn>;
};

/** Configura APIs simuladas; cada propiedad omitida representa una API ausente. */
function stubBrowser(options: {
  notificationPermission?: NotificationPermission;
  geolocation?: "denied" | "granted";
  serviceWorker?: "active" | "none";
  showNotification?: () => Promise<void>;
}): Env {
  const requestPermission = vi.fn().mockResolvedValue(options.notificationPermission ?? "default");
  const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
    if (options.geolocation === "denied") failure?.({ code: 1, message: "sintético" } as GeolocationPositionError);
    else success({ coords: { latitude: 12.3457, longitude: -45.6789, accuracy: 20 } } as GeolocationPosition);
  });
  const watchPosition = vi.fn();
  const showNotification = vi.fn(options.showNotification ?? (async () => undefined));

  if (options.notificationPermission) {
    vi.stubGlobal("Notification", { permission: options.notificationPermission, requestPermission });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: options.notificationPermission, requestPermission }
    });
  }
  const navigatorStub: Record<string, unknown> = {};
  if (options.geolocation) navigatorStub.geolocation = { getCurrentPosition, watchPosition };
  if (options.serviceWorker) {
    navigatorStub.serviceWorker = {
      getRegistration: vi.fn().mockResolvedValue(options.serviceWorker === "active" ? { active: {}, showNotification } : undefined)
    };
  }
  vi.stubGlobal("navigator", navigatorStub);
  return { requestPermission, getCurrentPosition, watchPosition, showNotification };
}

function saveInspection(): void {
  fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexión" }));
}

beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("inspection-id").mockReturnValueOnce("operation-id") });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "Notification");
  await deleteStorageDatabase();
});

async function expectSavedLocally(): Promise<void> {
  expect(await screen.findByText(SAVED_MESSAGE)).toHaveAttribute("role", "status");
  const inspections = await getAllInspections();
  const operations = await getAllOutboxOperations();
  expect(inspections).toHaveLength(1);
  expect(inspections[0]).toMatchObject({ id: "local-inspection-inspection-id", sync: { status: "pending" } });
  expect(operations).toHaveLength(1);
  expect(operations[0]).toMatchObject({ entityId: "local-inspection-inspection-id", type: "create", status: "pending" });
}

describe("capabilities — integración de guardado con capacidades opcionales", () => {
  it("guarda sin ninguna capacidad disponible (sin Notification, geolocalización ni service worker)", async () => {
    stubBrowser({});
    render(createElement(InspeccionesPage));

    saveInspection();

    await expectSavedLocally();
  });

  it("guarda con permisos denegados sin volver a solicitarlos", async () => {
    const env = stubBrowser({ notificationPermission: "denied", geolocation: "denied", serviceWorker: "active" });
    render(createElement(InspeccionesPage));

    saveInspection();

    await expectSavedLocally();
    expect(env.requestPermission).not.toHaveBeenCalled();
    expect(env.getCurrentPosition).not.toHaveBeenCalled();
    expect(env.showNotification).not.toHaveBeenCalled();
  });

  it("no solicita permisos ni lecturas de ubicación al montar, rerenderizar o guardar", async () => {
    const env = stubBrowser({ notificationPermission: "default", geolocation: "granted", serviceWorker: "none" });
    const view = render(createElement(InspeccionesPage));
    view.rerender(createElement(InspeccionesPage));

    saveInspection();
    await expectSavedLocally();

    expect(env.requestPermission).not.toHaveBeenCalled();
    expect(env.getCurrentPosition).not.toHaveBeenCalled();
    expect(env.watchPosition).not.toHaveBeenCalled();
  });

  it("solo solicita el permiso de notificaciones desde su botón explícito", async () => {
    const env = stubBrowser({ notificationPermission: "default", serviceWorker: "none" });
    render(createElement(InspeccionesPage));
    expect(env.requestPermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Habilitar notificaciones" }));

    await waitFor(() => expect(env.requestPermission).toHaveBeenCalledTimes(1));
    expect(env.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("conserva el guardado cuando la notificación del sistema falla", async () => {
    const env = stubBrowser({
      notificationPermission: "granted",
      serviceWorker: "active",
      showNotification: async () => {
        throw new Error("fallo sintético de notificación");
      }
    });
    render(createElement(InspeccionesPage));

    saveInspection();

    await expectSavedLocally();
    await waitFor(() => expect(env.showNotification).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/No se pudo guardar/)).not.toBeInTheDocument();
  });

  it("la notificación exitosa informa guardado local y no sincronización", async () => {
    const env = stubBrowser({ notificationPermission: "granted", serviceWorker: "active" });
    render(createElement(InspeccionesPage));

    saveInspection();

    await expectSavedLocally();
    await waitFor(() => expect(env.showNotification).toHaveBeenCalledTimes(1));
    const [title, notificationOptions] = env.showNotification.mock.calls[0];
    expect(`${title} ${notificationOptions.body}`).toMatch(/guardó en este dispositivo/);
    expect(`${title} ${notificationOptions.body}`).not.toMatch(/sincroniz/i);
  });

  // Dependen de Fernando (src/lib/device/capabilities-storage.ts) y de la integración final de Danna en
  // la página; no existen en main todavía. No se simulan módulos inexistentes para aparentar cobertura.
  it.todo("persiste y recupera evidencia y ubicación sintéticas tras recargar (requiere capabilities-storage.ts)");
  it.todo("conserva el guardado principal y avisa si falla el almacenamiento auxiliar (requiere capabilities-storage.ts)");
  it.todo("guarda con ubicación denegada desde LocationControl integrado en /inspecciones (requiere integración en la página)");
});
