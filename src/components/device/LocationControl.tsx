"use client";

import { useEffect, useRef, useState } from "react";
import type { CapabilityResult, DeviceLocationAttachment, LocationAttachment } from "@/lib/device/types";
import { getCurrentLocation } from "@/lib/device/geolocation";

type LocationControlProps = Readonly<{
  /** Se invoca con la ubicación obtenida o con `undefined` al quitarla. */
  onChange?: (location: LocationAttachment | undefined) => void;
  /** Valor inicial (por ejemplo, uno recuperado del almacenamiento auxiliar). */
  initialValue?: LocationAttachment;
}>;

function failureMessage(result: Exclude<CapabilityResult<DeviceLocationAttachment>, { status: "success" }>): string {
  return result.message;
}

export function LocationControl({ onChange, initialValue }: LocationControlProps) {
  const [location, setLocation] = useState<LocationAttachment | undefined>(initialValue);
  const [message, setMessage] = useState<string>("La ubicación es opcional y solo se solicita al pulsar el botón.");
  const [isRequesting, setIsRequesting] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsRequesting(true);
    setMessage("Obteniendo ubicación…");
    try {
      const result = await getCurrentLocation();
      if (!mounted.current) return;
      if (result.status === "success") {
        setLocation(result.data);
        setMessage("Ubicación agregada. Se conserva solo en este dispositivo.");
        onChange?.(result.data);
      } else {
        setMessage(failureMessage(result));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsRequesting(false);
    }
  };

  const remove = () => {
    setLocation(undefined);
    setMessage("Ubicación quitada.");
    onChange?.(undefined);
  };

  return (
    <section aria-labelledby="location-control-heading">
      <h3 id="location-control-heading">Ubicación (opcional)</h3>
      <p id="location-control-status" role="status" aria-live="polite">
        {message}
      </p>
      {location ? (
        <p data-testid="location-value">
          Lat. {location.latitude}, Lon. {location.longitude} (±{location.accuracyMeters} m)
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          className="btn btn-primary"
          type="button"
          aria-describedby="location-control-status"
          disabled={isRequesting}
          onClick={() => void request()}
        >
          {isRequesting ? "Obteniendo ubicación…" : location ? "Actualizar ubicación" : "Obtener ubicación"}
        </button>
        {location ? (
          <button className="btn btn-danger" type="button" disabled={isRequesting} onClick={remove}>
            Quitar ubicación
          </button>
        ) : null}
      </div>
    </section>
  );
}
