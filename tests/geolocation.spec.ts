import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COORDINATE_DECIMALS, DEFAULT_LOCATION_TIMEOUT_MS, getCurrentLocation } from "@/lib/device/geolocation";
import { LocationControl } from "@/components/device/LocationControl";

// Coordenadas ficticias (datos sintéticos); no corresponden a ninguna ubicación real.
const SYNTHETIC = { latitude: 12.345678, longitude: -45.678912, accuracy: 25.4 };

function position(coords = SYNTHETIC): GeolocationPosition {
  return { coords: { ...coords, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: 0 } as unknown as GeolocationPosition;
}

function geolocationError(code: number): GeolocationPositionError {
  return { code, message: "sintético", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

type Mock = ReturnType<typeof stubGeolocation>;

function stubGeolocation(
  behavior: (success: PositionCallback, failure: PositionErrorCallback | null | undefined, options?: PositionOptions) => void
) {
  const getCurrentPosition = vi.fn(behavior);
  const watchPosition = vi.fn();
  const clearWatch = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition, watchPosition, clearWatch } });
  return { getCurrentPosition, watchPosition, clearWatch };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getCurrentLocation", () => {
  it("devuelve coordenadas ficticias válidas, redondeadas y etiquetadas como device-api", async () => {
    stubGeolocation((success) => success(position()));

    const result = await getCurrentLocation();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(COORDINATE_DECIMALS).toBe(4);
    expect(result.data).toMatchObject({
      source: "device-api",
      latitude: 12.3457,
      longitude: -45.6789,
      accuracyMeters: 25
    });
    expect(Number.isNaN(Date.parse(result.data.capturedAt))).toBe(false);
  });

  it("devuelve unsupported cuando la API no existe", async () => {
    vi.stubGlobal("navigator", {});
    const result = await getCurrentLocation();
    expect(result.status).toBe("unsupported");
    expect(result).toHaveProperty("message");
  });

  it("devuelve unsupported cuando no hay navigator (SSR)", async () => {
    vi.stubGlobal("navigator", undefined);
    expect((await getCurrentLocation()).status).toBe("unsupported");
  });

  it("clasifica permiso denegado", async () => {
    stubGeolocation((_ok, fail) => fail?.(geolocationError(1)));
    expect((await getCurrentLocation()).status).toBe("permission-denied");
  });

  it("clasifica posición no disponible como error controlado", async () => {
    stubGeolocation((_ok, fail) => fail?.(geolocationError(2)));
    const result = await getCurrentLocation();
    expect(result.status).toBe("error");
    expect(result).toHaveProperty("message");
  });

  it("clasifica timeout reportado por el navegador", async () => {
    stubGeolocation((_ok, fail) => fail?.(geolocationError(3)));
    expect((await getCurrentLocation()).status).toBe("timeout");
  });

  it("no espera indefinidamente si el navegador nunca invoca callbacks", async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {});

    const pending = getCurrentLocation({ timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(3_100);

    expect((await pending).status).toBe("timeout");
  });

  it("ignora un callback tardío después del timeout de resguardo", async () => {
    vi.useFakeTimers();
    let late: PositionCallback | undefined;
    stubGeolocation((success) => {
      late = success;
    });

    const pending = getCurrentLocation({ timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(2_600);
    late?.(position());

    expect((await pending).status).toBe("timeout");
  });

  it("hace una sola lectura, sin watchPosition y sin alta precisión", async () => {
    const mock: Mock = stubGeolocation((success) => success(position()));

    await getCurrentLocation();

    expect(mock.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(mock.watchPosition).not.toHaveBeenCalled();
    expect(mock.getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: false,
      timeout: DEFAULT_LOCATION_TIMEOUT_MS,
      maximumAge: 0
    });
  });

  it("acota tiempos de espera inválidos o excesivos", async () => {
    const mock = stubGeolocation((success) => success(position()));
    await getCurrentLocation({ timeoutMs: -5, maximumAgeMs: -1 });
    await getCurrentLocation({ timeoutMs: 999_999 });

    expect(mock.getCurrentPosition.mock.calls[0][2]).toMatchObject({ timeout: DEFAULT_LOCATION_TIMEOUT_MS, maximumAge: 0 });
    expect(mock.getCurrentPosition.mock.calls[1][2]).toMatchObject({ timeout: 30_000 });
  });

  it("rechaza coordenadas fuera de rango o no finitas sin propagar excepciones", async () => {
    stubGeolocation((success) => success(position({ latitude: 123, longitude: 0, accuracy: 5 })));
    expect((await getCurrentLocation()).status).toBe("error");

    stubGeolocation((success) => success(position({ latitude: Number.NaN, longitude: 0, accuracy: 5 })));
    expect((await getCurrentLocation()).status).toBe("error");
  });

  it("convierte una excepción síncrona de la API en error controlado", async () => {
    stubGeolocation(() => {
      throw new Error("fallo sintético");
    });
    expect((await getCurrentLocation()).status).toBe("error");
  });

  it("no accede a la API al importar el módulo (importable sin navigator)", async () => {
    vi.stubGlobal("navigator", undefined);
    vi.resetModules();
    await expect(import("@/lib/device/geolocation")).resolves.toHaveProperty("getCurrentLocation");
  });
});

describe("LocationControl", () => {
  it("no solicita ubicación al montar ni al renderizar de nuevo", () => {
    const mock = stubGeolocation((success) => success(position()));
    const view = render(createElement(LocationControl));
    view.rerender(createElement(LocationControl));
    expect(mock.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("solicita una lectura solo desde el botón, la muestra y permite quitarla", async () => {
    const mock = stubGeolocation((success) => success(position()));
    const onChange = vi.fn();
    render(createElement(LocationControl, { onChange }));

    fireEvent.click(screen.getByRole("button", { name: "Obtener ubicación" }));

    expect(await screen.findByTestId("location-value")).toHaveTextContent("12.3457");
    expect(mock.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: "device-api", latitude: 12.3457 }));

    fireEvent.click(screen.getByRole("button", { name: "Quitar ubicación" }));
    expect(screen.queryByTestId("location-value")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("muestra el fallback si el permiso es denegado y no entrega ubicación", async () => {
    stubGeolocation((_ok, fail) => fail?.(geolocationError(1)));
    const onChange = vi.fn();
    render(createElement(LocationControl, { onChange }));

    fireEvent.click(screen.getByRole("button", { name: "Obtener ubicación" }));

    expect(await screen.findByText(/permiso de ubicación fue denegado/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Obtener ubicación" })).toBeEnabled();
  });

  it("evita solicitudes repetidas mientras hay una en curso", async () => {
    let finish: PositionCallback | undefined;
    const mock = stubGeolocation((success) => {
      finish = success;
    });
    render(createElement(LocationControl));

    const button = screen.getByRole("button", { name: "Obtener ubicación" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mock.getCurrentPosition).toHaveBeenCalledTimes(1);

    finish?.(position());
    await waitFor(() => expect(screen.getByTestId("location-value")).toBeInTheDocument());
  });

  it("no actualiza estado ni notifica si se desmonta durante la lectura", async () => {
    let finish: PositionCallback | undefined;
    stubGeolocation((success) => {
      finish = success;
    });
    const onChange = vi.fn();
    const view = render(createElement(LocationControl, { onChange }));

    fireEvent.click(screen.getByRole("button", { name: "Obtener ubicación" }));
    view.unmount();
    finish?.(position());
    await Promise.resolve();

    expect(onChange).not.toHaveBeenCalled();
  });
});
