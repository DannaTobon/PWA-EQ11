"use client";

import { useState } from "react";
import type { CapabilityResult, LocalNotificationPermission } from "@/lib/device/types";
import { enableLocalNotifications } from "@/lib/notifications/client";

type ControlResult = CapabilityResult<LocalNotificationPermission> | null;

function statusMessage(result: ControlResult): string {
  if (!result) return "Las notificaciones son opcionales y requieren una acción explícita.";
  if (result.status === "success") return "Notificaciones locales habilitadas.";
  return result.message;
}

export function NotificationControl() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [result, setResult] = useState<ControlResult>(null);

  const enable = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      setResult(await enableLocalNotifications());
    } finally {
      setIsRequesting(false);
    }
  };

  const isFinal = result?.status === "success" || result?.status === "permission-denied" || result?.status === "unsupported";

  return (
    <section aria-labelledby="notification-control-heading">
      <h3 id="notification-control-heading">Notificaciones locales</h3>
      <p id="notification-control-status" role="status" aria-live="polite">
        {statusMessage(result)}
      </p>
      <button
        className="btn btn-primary"
        type="button"
        aria-describedby="notification-control-status"
        disabled={isRequesting || isFinal}
        onClick={() => void enable()}
      >
        {isRequesting ? "Solicitando permiso…" : result?.status === "success" ? "Notificaciones habilitadas" : "Habilitar notificaciones"}
      </button>
    </section>
  );
}
