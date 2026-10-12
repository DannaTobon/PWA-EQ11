import type { CapabilityResult, DeviceLocationAttachment } from "@/lib/device/types";

export type CurrentLocationOptions = Readonly<{
  /** Tiempo máximo de espera de la lectura, en milisegundos. */
  timeoutMs?: number;
  /** Antigüedad máxima aceptada de una lectura en caché, en milisegundos. */
  maximumAgeMs?: number;
}>;

/** Valores por defecto: sin alta precisión, sin caché y con espera acotada. */
export const DEFAULT_LOCATION_TIMEOUT_MS = 10_000;
export const MAX_LOCATION_TIMEOUT_MS = 30_000;
/** Margen para el temporizador de resguardo, por si el navegador nunca invoca ningún callback. */
const SAFETY_GRACE_MS = 2_000;
/** 4 decimales ≈ 11 m de resolución: suficiente para una inspección y menos preciso que la lectura cruda. */
export const COORDINATE_DECIMALS = 4;

const MESSAGES = {
  unsupported: "La geolocalización no está disponible en este entorno. Puedes continuar sin ubicación.",
  denied: "El permiso de ubicación fue denegado. Puedes continuar sin ubicación.",
  unavailable: "No fue posible determinar la ubicación. Puedes continuar sin ubicación.",
  timeout: "La lectura de ubicación tardó demasiado. Puedes continuar sin ubicación.",
  invalid: "El dispositivo devolvió una ubicación no válida. Puedes continuar sin ubicación.",
  generic: "No se pudo obtener la ubicación. Puedes continuar sin ubicación."
} as const;

// Códigos de GeolocationPositionError (se evita depender del constructor global, que no existe en SSR).
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeTimeout(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return DEFAULT_LOCATION_TIMEOUT_MS;
  return Math.min(value, MAX_LOCATION_TIMEOUT_MS);
}

function normalizeMaximumAge(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function toAttachment(position: GeolocationPosition): DeviceLocationAttachment | null {
  const coords = position?.coords;
  if (!coords) return null;
  const { latitude, longitude, accuracy } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    source: "device-api",
    latitude: roundTo(latitude, COORDINATE_DECIMALS),
    longitude: roundTo(longitude, COORDINATE_DECIMALS),
    accuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : 0,
    capturedAt: new Date().toISOString()
  };
}

function failureFromCode(code: unknown): CapabilityResult<DeviceLocationAttachment> {
  switch (code) {
    case PERMISSION_DENIED:
      return { status: "permission-denied", message: MESSAGES.denied };
    case POSITION_UNAVAILABLE:
      return { status: "error", message: MESSAGES.unavailable };
    case TIMEOUT:
      return { status: "timeout", message: MESSAGES.timeout };
    default:
      return { status: "error", message: MESSAGES.generic };
  }
}

/**
 * Lectura puntual de ubicación. Debe invocarse únicamente desde una acción explícita.
 * Nunca usa `watchPosition`, no solicita alta precisión y siempre resuelve (no rechaza).
 * El acceso a `navigator` ocurre dentro de la función, por lo que importar el módulo es seguro en SSR.
 */
export function getCurrentLocation(
  options: CurrentLocationOptions = {}
): Promise<CapabilityResult<DeviceLocationAttachment>> {
  if (typeof navigator === "undefined" || !navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
    return Promise.resolve({ status: "unsupported", message: MESSAGES.unsupported });
  }

  const timeout = normalizeTimeout(options.timeoutMs);
  const maximumAge = normalizeMaximumAge(options.maximumAgeMs);

  return new Promise((resolve) => {
    let settled = false;
    let guard: ReturnType<typeof setTimeout> | undefined;

    const settle = (result: CapabilityResult<DeviceLocationAttachment>) => {
      if (settled) return;
      settled = true;
      if (guard !== undefined) clearTimeout(guard);
      resolve(result);
    };

    guard = setTimeout(() => settle({ status: "timeout", message: MESSAGES.timeout }), timeout + SAFETY_GRACE_MS);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const attachment = toAttachment(position);
          settle(attachment ? { status: "success", data: attachment } : { status: "error", message: MESSAGES.invalid });
        },
        (error) => settle(failureFromCode(error?.code)),
        { enableHighAccuracy: false, timeout, maximumAge }
      );
    } catch {
      settle({ status: "error", message: MESSAGES.generic });
    }
  });
}
