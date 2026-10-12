import type { CapabilityResult, DeviceEvidenceAttachment } from "@/lib/device/types";

/** Límite configurable del tamaño de imagen en bytes (por defecto 2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Formato MIME de salida. */
export const CAPTURE_MIME_TYPE = "image/jpeg";
/** Calidad JPEG (0–1). */
export const CAPTURE_QUALITY = 0.85;

const MESSAGES = {
  unsupported:
    "La cámara no está disponible en este entorno. Puedes continuar sin evidencia fotográfica.",
  denied:
    "El permiso de cámara fue denegado. Puedes continuar sin evidencia fotográfica.",
  cancelled:
    "La captura fue cancelada. Puedes continuar sin evidencia fotográfica.",
  noTrack:
    "No se recibió ninguna pista de video. Puedes continuar sin evidencia fotográfica.",
  tooLarge:
    "La imagen capturada excede el tamaño máximo permitido. Puedes continuar sin evidencia fotográfica.",
  generic:
    "No se pudo acceder a la cámara. Puedes continuar sin evidencia fotográfica.",
} as const;

// ── Detección de soporte ──────────────────────────────────────────────

/**
 * Comprueba que `navigator.mediaDevices.getUserMedia` exista.
 * Segura en SSR: devuelve `false` si `navigator` no está definido.
 */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

// ── Gestión del stream ────────────────────────────────────────────────

/**
 * Libera todos los tracks de un MediaStream.
 * Idempotente: llamar con `null` o un stream ya detenido no falla.
 */
export function releaseStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Solicita acceso a la cámara de video **sin audio**.
 * Toda interacción con `navigator` ocurre aquí, por lo que importar
 * el módulo es seguro en SSR/build.
 */
export async function startCamera(): Promise<CapabilityResult<MediaStream>> {
  if (!isCameraSupported()) {
    return { status: "unsupported", message: MESSAGES.unsupported };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      releaseStream(stream);
      return { status: "error", message: MESSAGES.noTrack };
    }

    return { status: "success", data: stream };
  } catch (error: unknown) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name: unknown }).name)
        : "";

    if (
      errorName === "NotAllowedError" ||
      errorName === "PermissionDeniedError"
    ) {
      return { status: "permission-denied", message: MESSAGES.denied };
    }
    if (errorName === "AbortError") {
      return { status: "cancelled", message: MESSAGES.cancelled };
    }
    return { status: "error", message: MESSAGES.generic };
  }
}

// ── Captura de frame ──────────────────────────────────────────────────

/**
 * Captura un frame del stream de video activo y lo devuelve como
 * `DeviceEvidenceAttachment`. Valida el tamaño contra `MAX_IMAGE_BYTES`.
 *
 * No detiene el stream; eso es responsabilidad del componente (o de `releaseStream`).
 */
export async function captureFrame(
  videoElement: HTMLVideoElement
): Promise<CapabilityResult<DeviceEvidenceAttachment>> {
  if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    return { status: "error", message: MESSAGES.generic };
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { status: "error", message: MESSAGES.generic };
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), CAPTURE_MIME_TYPE, CAPTURE_QUALITY)
    );

    if (!blob || blob.size === 0) {
      return { status: "error", message: MESSAGES.generic };
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      return { status: "error", message: MESSAGES.tooLarge };
    }

    const attachment: DeviceEvidenceAttachment = {
      source: "device-api",
      blob,
      mimeType: CAPTURE_MIME_TYPE,
      capturedAt: new Date().toISOString(),
    };

    return { status: "success", data: attachment };
  } catch {
    return { status: "error", message: MESSAGES.generic };
  }
}

// ── Alias de contrato público acordado en docs/capabilities.md ────────
export const requestCameraStream = startCamera;
export const releaseCameraStream = releaseStream;
export const captureEvidence = captureFrame;

