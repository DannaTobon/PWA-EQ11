import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCameraSupported,
  startCamera,
  captureFrame,
  releaseStream,
  MAX_IMAGE_BYTES,
  CAPTURE_MIME_TYPE,
} from "@/lib/device/camera";

// ── Helpers de mock ──────────────────────────────────────────────────

function mockMediaStream(trackCount = 1): MediaStream {
  const tracks: MediaStreamTrack[] = [];
  for (let i = 0; i < trackCount; i++) {
    tracks.push({ stop: vi.fn(), kind: "video" } as unknown as MediaStreamTrack);
  }
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

function setupGetUserMedia(result: MediaStream | Error | DOMException) {
  const isError =
    result instanceof Error ||
    (typeof DOMException !== "undefined" && result instanceof DOMException) ||
    (typeof result === "object" && result !== null && !("getVideoTracks" in result));

  const getUserMedia = isError
    ? vi.fn().mockRejectedValue(result)
    : vi.fn().mockResolvedValue(result);

  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    writable: true,
    configurable: true,
  });
  return getUserMedia;
}

function clearMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("módulo de cámara", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearMediaDevices();
  });

  // ── Soporte ────────────────────────────────────────────────────────

  describe("isCameraSupported", () => {
    it("devuelve false cuando navigator.mediaDevices no existe", () => {
      clearMediaDevices();
      expect(isCameraSupported()).toBe(false);
    });

    it("devuelve true cuando getUserMedia es una función", () => {
      setupGetUserMedia(mockMediaStream());
      expect(isCameraSupported()).toBe(true);
    });
  });

  // ── startCamera ────────────────────────────────────────────────────

  describe("startCamera", () => {
    it("devuelve unsupported cuando la API no está disponible", async () => {
      clearMediaDevices();
      const result = await startCamera();
      expect(result.status).toBe("unsupported");
    });

    it("devuelve permission-denied cuando el usuario rechaza el permiso", async () => {
      const error = new DOMException("Permiso denegado", "NotAllowedError");
      setupGetUserMedia(error);
      const result = await startCamera();
      expect(result.status).toBe("permission-denied");
    });

    it("devuelve cancelled ante AbortError", async () => {
      const error = new DOMException("Abortado", "AbortError");
      setupGetUserMedia(error);
      const result = await startCamera();
      expect(result.status).toBe("cancelled");
    });

    it("devuelve error genérico ante errores desconocidos", async () => {
      setupGetUserMedia(new Error("Fallo inesperado"));
      const result = await startCamera();
      expect(result.status).toBe("error");
    });

    it("solicita video sin audio", async () => {
      const stream = mockMediaStream();
      const gum = setupGetUserMedia(stream);
      await startCamera();
      expect(gum).toHaveBeenCalledWith({ video: true, audio: false });
    });

    it("devuelve el stream cuando tiene pistas de video", async () => {
      const stream = mockMediaStream(1);
      setupGetUserMedia(stream);
      const result = await startCamera();
      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.data).toBe(stream);
      }
    });

    it("devuelve error y libera el stream si no hay pistas de video", async () => {
      const stream = {
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
      setupGetUserMedia(stream);
      const result = await startCamera();
      expect(result.status).toBe("error");
    });
  });

  // ── releaseStream ──────────────────────────────────────────────────

  describe("releaseStream", () => {
    it("detiene todos los tracks del stream", () => {
      const stream = mockMediaStream(2);
      releaseStream(stream);
      for (const track of stream.getTracks()) {
        expect(track.stop).toHaveBeenCalled();
      }
    });

    it("no falla con null", () => {
      expect(() => releaseStream(null)).not.toThrow();
    });
  });

  // ── captureFrame ───────────────────────────────────────────────────

  describe("captureFrame", () => {
    it("devuelve error si el video no tiene dimensiones", async () => {
      const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
      const result = await captureFrame(video);
      expect(result.status).toBe("error");
    });

    it("captura un frame y devuelve un DeviceEvidenceAttachment", async () => {
      // Mock canvas y toBlob
      const fakeBlob = new Blob(["test-image"], { type: CAPTURE_MIME_TYPE });
      const mockCtx = {
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((callback: (b: Blob) => void) => callback(fakeBlob)),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockCanvas as unknown as HTMLCanvasElement
      );

      const video = {
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      const result = await captureFrame(video);
      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.data.source).toBe("device-api");
        expect(result.data.mimeType).toBe(CAPTURE_MIME_TYPE);
        expect(result.data.blob).toBe(fakeBlob);
        expect(result.data.capturedAt).toBeTruthy();
      }
    });

    it("devuelve error si la imagen excede MAX_IMAGE_BYTES", async () => {
      const largeBlob = new Blob([new ArrayBuffer(MAX_IMAGE_BYTES + 1)], {
        type: CAPTURE_MIME_TYPE,
      });
      const mockCtx = { drawImage: vi.fn() };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((callback: (b: Blob) => void) => callback(largeBlob)),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockCanvas as unknown as HTMLCanvasElement
      );

      const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
      const result = await captureFrame(video);
      expect(result.status).toBe("error");
      if (result.status !== "success") {
        expect(result.message).toContain("tamaño máximo");
      }
    });

    it("devuelve error si getContext devuelve null", async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
        toBlob: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockCanvas as unknown as HTMLCanvasElement
      );

      const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
      const result = await captureFrame(video);
      expect(result.status).toBe("error");
    });
  });
});
