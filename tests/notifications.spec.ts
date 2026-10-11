import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalNotificationMessage } from "@/lib/device/types";

const MESSAGE: LocalNotificationMessage = {
  title: "Inspección guardada",
  body: "Una inspección sintética se guardó localmente.",
  tag: "inspection-saved"
};

type PermissionRequest = ReturnType<typeof vi.fn<() => Promise<NotificationPermission>>>;

function setSecureContext(value = true): void {
  Object.defineProperty(window, "isSecureContext", { value, configurable: true });
}

function setNotificationApi(permission: NotificationPermission, requestPermission?: PermissionRequest): PermissionRequest {
  const request = requestPermission ?? vi.fn<() => Promise<NotificationPermission>>();
  Object.defineProperty(window, "Notification", {
    value: { permission, requestPermission: request },
    configurable: true
  });
  return request;
}

function setServiceWorker(getRegistration: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { getRegistration },
    configurable: true
  });
}

async function loadClient() {
  return import("@/lib/notifications/client");
}

beforeEach(() => {
  vi.resetModules();
  setSecureContext();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "isSecureContext");
});

describe("cliente de notificaciones locales", () => {
  it("se importa sin APIs de navegador", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);

    const client = await loadClient();

    expect(client.enableLocalNotifications).toBeTypeOf("function");
    expect(client.showLocalNotification).toBeTypeOf("function");
  });

  it("importar el módulo no solicita permisos", async () => {
    const requestPermission = setNotificationApi("default");

    await loadClient();

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("devuelve unsupported cuando la API no existe", async () => {
    const { enableLocalNotifications } = await loadClient();
    const result = await enableLocalNotifications();

    expect(result.status).toBe("unsupported");
  });

  it("reutiliza un permiso concedido sin solicitarlo nuevamente", async () => {
    const requestPermission = setNotificationApi("granted");
    const { enableLocalNotifications } = await loadClient();

    await expect(enableLocalNotifications()).resolves.toEqual({ status: "success", data: "granted" });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("devuelve permission-denied sin repetir una solicitud denegada", async () => {
    const requestPermission = setNotificationApi("denied");
    const { enableLocalNotifications } = await loadClient();
    const result = await enableLocalNotifications();

    expect(result.status).toBe("permission-denied");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("solicita permiso al invocarse explícitamente cuando está en default", async () => {
    const requestPermission = vi.fn<() => Promise<NotificationPermission>>().mockResolvedValue("granted");
    setNotificationApi("default", requestPermission);
    const { enableLocalNotifications } = await loadClient();

    await expect(enableLocalNotifications()).resolves.toEqual({ status: "success", data: "granted" });
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("trata como cancelación que el permiso permanezca en default", async () => {
    setNotificationApi("default", vi.fn<() => Promise<NotificationPermission>>().mockResolvedValue("default"));
    const { enableLocalNotifications } = await loadClient();
    const result = await enableLocalNotifications();

    expect(result.status).toBe("cancelled");
  });

  it("devuelve error si requestPermission rechaza", async () => {
    setNotificationApi("default", vi.fn<() => Promise<NotificationPermission>>().mockRejectedValue(new Error("fallo sintético")));
    const { enableLocalNotifications } = await loadClient();
    const result = await enableLocalNotifications();

    expect(result.status).toBe("error");
  });

  it("devuelve unsupported cuando no hay service worker activo", async () => {
    setNotificationApi("granted");
    setServiceWorker(vi.fn().mockResolvedValue({ active: null, showNotification: vi.fn() }));
    const { showLocalNotification } = await loadClient();
    const result = await showLocalNotification(MESSAGE);

    expect(result.status).toBe("unsupported");
  });

  it("devuelve error cuando falla la consulta de la inscripción", async () => {
    setNotificationApi("granted");
    setServiceWorker(vi.fn().mockRejectedValue(new Error("fallo sintético")));
    const { showLocalNotification } = await loadClient();
    const result = await showLocalNotification(MESSAGE);

    expect(result.status).toBe("error");
  });

  it("muestra la notificación mediante la inscripción activa", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00.000Z"));
    const showNotification = vi.fn().mockResolvedValue(undefined);
    setNotificationApi("granted");
    setServiceWorker(vi.fn().mockResolvedValue({ active: {}, showNotification }));
    const { showLocalNotification } = await loadClient();

    await expect(showLocalNotification(MESSAGE)).resolves.toEqual({
      status: "success",
      data: { channel: "service-worker", shownAt: "2026-10-10T12:00:00.000Z" }
    });
    expect(showNotification).toHaveBeenCalledWith(MESSAGE.title, { body: MESSAGE.body, tag: MESSAGE.tag });
  });

  it("devuelve error cuando showNotification rechaza", async () => {
    setNotificationApi("granted");
    setServiceWorker(vi.fn().mockResolvedValue({ active: {}, showNotification: vi.fn().mockRejectedValue(new Error("fallo sintético")) }));
    const { showLocalNotification } = await loadClient();
    const result = await showLocalNotification(MESSAGE);

    expect(result.status).toBe("error");
  });

  it("showLocalNotification no solicita permisos", async () => {
    const requestPermission = setNotificationApi("default");
    setServiceWorker(vi.fn());
    const { showLocalNotification } = await loadClient();
    const result = await showLocalNotification(MESSAGE);

    expect(result.status).toBe("cancelled");
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
