import type {
  CapabilityFailure,
  CapabilityResult,
  LocalNotificationDelivery,
  LocalNotificationMessage,
  LocalNotificationPermission
} from "@/lib/device/types";

const UNSUPPORTED_MESSAGE = "Las notificaciones locales no están disponibles en este entorno.";

function hasNotificationSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    typeof window.Notification !== "undefined"
  );
}

function permissionFailure(permission: Exclude<NotificationPermission, "granted">): CapabilityFailure {
  if (permission === "denied") {
    return {
      status: "permission-denied",
      message: "El permiso de notificaciones está denegado. La confirmación seguirá visible en la aplicación."
    };
  }
  return {
    status: "cancelled",
    message: "No se concedió el permiso. La confirmación seguirá visible en la aplicación."
  };
}

/** Solicita permiso solo cuando el consumidor la invoca desde una acción explícita. */
export async function enableLocalNotifications(): Promise<CapabilityResult<LocalNotificationPermission>> {
  if (!hasNotificationSupport()) {
    return { status: "unsupported", message: UNSUPPORTED_MESSAGE };
  }

  const currentPermission = window.Notification.permission;
  if (currentPermission === "granted") {
    return { status: "success", data: "granted" };
  }
  if (currentPermission === "denied") {
    return permissionFailure(currentPermission);
  }

  try {
    const requestedPermission = await window.Notification.requestPermission();
    return requestedPermission === "granted"
      ? { status: "success", data: "granted" }
      : permissionFailure(requestedPermission);
  } catch {
    return {
      status: "error",
      message: "No se pudo solicitar el permiso de notificaciones. La aplicación puede seguir utilizándose."
    };
  }
}

/** Muestra una notificación local mediante el SW existente; nunca solicita permiso ni registra otro worker. */
export async function showLocalNotification(
  message: LocalNotificationMessage
): Promise<CapabilityResult<LocalNotificationDelivery>> {
  if (!hasNotificationSupport() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { status: "unsupported", message: UNSUPPORTED_MESSAGE };
  }

  const permission = window.Notification.permission;
  if (permission !== "granted") {
    return permissionFailure(permission);
  }

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.getRegistration();
  } catch {
    return {
      status: "error",
      message: "No se pudo consultar el service worker. La confirmación seguirá visible en la aplicación."
    };
  }

  if (!registration?.active || typeof registration.showNotification !== "function") {
    return {
      status: "unsupported",
      message: "No hay un service worker activo para mostrar la notificación local."
    };
  }

  try {
    await registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag
    });
    return {
      status: "success",
      data: { channel: "service-worker", shownAt: new Date().toISOString() }
    };
  } catch {
    return {
      status: "error",
      message: "No se pudo mostrar la notificación. La confirmación seguirá visible en la aplicación."
    };
  }
}
