"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isCameraSupported,
  startCamera,
  captureFrame,
  releaseStream,
} from "@/lib/device/camera";
import { saveEvidence, removeEvidence, getCapabilityRecord } from "@/lib/device/evidence-storage";
import type { EvidenceAttachment } from "@/lib/device/types";

type CameraEvidenceControlProps = {
  /** Identificador estable de la inspección a la que se asocia la evidencia. */
  inspectionId: string;
};

type CameraState = "idle" | "starting" | "previewing" | "capturing";

/**
 * Control de evidencia fotográfica opcional.
 *
 * - Muestra el estado del soporte y el permiso.
 * - Inicia / detiene el stream de cámara bajo acción explícita del usuario.
 * - Captura un frame, lo almacena en la base auxiliar y genera una vista previa local.
 * - Permite quitar la evidencia almacenada.
 * - Libera todos los tracks y revoca las URL de vista previa al desmontar.
 */
export function CameraEvidenceControl({ inspectionId }: CameraEvidenceControlProps) {
  const [state, setState] = useState<CameraState>("idle");
  const [supported] = useState(() => isCameraSupported());
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasStoredEvidence, setHasStoredEvidence] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── Carga inicial: verificar si ya existe evidencia almacenada ────
  useEffect(() => {
    if (!inspectionId) return;
    let cancelled = false;
    void getCapabilityRecord(inspectionId)
      .then((record) => {
        if (cancelled) return;
        if (record?.evidence) {
          setHasStoredEvidence(true);
          const url = URL.createObjectURL(record.evidence.blob);
          setPreviewUrl(url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [inspectionId]);

  // ── Limpieza al desmontar ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      releaseStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  // Revocar URL de vista previa anterior al crear una nueva
  const revokePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // ── Iniciar cámara ────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setMessage(null);
    setState("starting");

    const result = await startCamera();

    if (result.status !== "success") {
      setMessage(result.message);
      setState("idle");
      return;
    }

    streamRef.current = result.data;

    if (videoRef.current) {
      videoRef.current.srcObject = result.data;
      try {
        await videoRef.current.play();
      } catch {
        // El navegador puede bloquear autoplay; el usuario puede reintentar.
      }
    }

    setState("previewing");
  }, []);

  // ── Detener cámara ────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    releaseStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("idle");
    setMessage(null);
  }, []);

  // ── Capturar frame ────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || state !== "previewing") return;

    setState("capturing");
    const result = await captureFrame(videoRef.current);

    if (result.status !== "success") {
      setMessage(result.message);
      setState("previewing");
      return;
    }

    // Almacenar en base auxiliar
    try {
      await saveEvidence(inspectionId, result.data);
      revokePreview();
      const url = URL.createObjectURL(result.data.blob);
      setPreviewUrl(url);
      setHasStoredEvidence(true);
      setMessage("Evidencia fotográfica guardada localmente.");
    } catch {
      setMessage("No se pudo guardar la evidencia. La inspección se conserva sin foto.");
    }

    // Detener la cámara después de capturar
    releaseStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("idle");
  }, [inspectionId, state, revokePreview]);

  // ── Quitar evidencia ──────────────────────────────────────────────
  const handleRemove = useCallback(async () => {
    try {
      await removeEvidence(inspectionId);
      revokePreview();
      setHasStoredEvidence(false);
      setMessage("Evidencia fotográfica eliminada.");
    } catch {
      setMessage("No se pudo eliminar la evidencia.");
    }
  }, [inspectionId, revokePreview]);

  // ── Render ────────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div aria-label="Control de cámara">
        <p className="muted">
          La cámara no está disponible en este entorno. Puedes continuar sin
          evidencia fotográfica.
        </p>
      </div>
    );
  }

  return (
    <div aria-label="Control de cámara" style={{ display: "grid", gap: "12px" }}>
      <p className="eyebrow">Evidencia fotográfica (opcional)</p>

      {/* Video de vista previa de la cámara */}
      {(state === "previewing" || state === "capturing") && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "8px",
            background: "#000",
          }}
        />
      )}
      {/* Elemento oculto para mantener la ref cuando no se muestra */}
      {state !== "previewing" && state !== "capturing" && (
        <video ref={videoRef} style={{ display: "none" }} />
      )}

      {/* Vista previa de la imagen capturada */}
      {previewUrl && state === "idle" && (
        <div style={{ textAlign: "center" }}>
          <img
            src={previewUrl}
            alt="Evidencia fotográfica capturada"
            style={{
              maxWidth: "100%",
              maxHeight: "240px",
              borderRadius: "8px",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {/* Botones de control */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {state === "idle" && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleStart()}
          >
            {hasStoredEvidence ? "Recapturar foto" : "Abrir cámara"}
          </button>
        )}

        {state === "starting" && (
          <button type="button" className="btn" disabled>
            Iniciando cámara…
          </button>
        )}

        {state === "previewing" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCapture()}
            >
              Capturar
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleStop}
            >
              Cancelar
            </button>
          </>
        )}

        {state === "capturing" && (
          <button type="button" className="btn" disabled>
            Capturando…
          </button>
        )}

        {hasStoredEvidence && state === "idle" && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void handleRemove()}
          >
            Quitar evidencia
          </button>
        )}
      </div>

      {/* Mensaje de estado */}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
