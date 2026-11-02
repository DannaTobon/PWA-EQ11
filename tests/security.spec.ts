import "fake-indexeddb/auto";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/inspecciones/route";
import InspeccionesPage from "@/app/inspecciones/page";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import nextConfig from "../next.config.mjs";
import {
  INSPECTION_LIMITS,
  MAX_INSPECTION_REQUEST_BYTES,
  clearLocalApplicationData,
  validateInspection,
  validateInspectionMutation
} from "@/lib/security";
import {
  deleteStorageDatabase,
  getAllInspections,
  getAllOutboxOperations,
  saveInspectionWithOperation
} from "@/lib/storage/indexeddb";
import {
  assertOutboxOperation,
  isStoredInspection,
  type OutboxOperation,
  type StoredInspection
} from "@/lib/storage/schema";
import {
  deleteCapabilitiesDatabase,
  getInspectionCapabilities,
  saveInspectionCapabilities
} from "@/lib/device/capabilities-storage";
import { resetServerStore } from "@/lib/sync/api-store";

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

const validInspection = {
  id: "inspection-security-001",
  location: "Laboratorio Sintético de Seguridad",
  date: "2026-11-01",
  inspector: "Técnica Sintética",
  status: "ok",
  statusLabel: "Sin incidencias",
  findings: 0,
  summary: "Inspección sintética para comprobar controles de entrada."
};

function mutation(payload: unknown = validInspection) {
  return {
    operationId: "operation-security-001",
    entityId: validInspection.id,
    type: "create",
    payload,
    baseRevision: null
  };
}

function apiRequest(body: string, contentType = "application/json; charset=utf-8"): Request {
  return new Request("http://localhost/api/inspecciones", {
    method: "POST",
    headers: { "Content-Type": contentType, "Idempotency-Key": "operation-security-001" },
    body
  });
}

function bodyWithExactByteLength(value: unknown, byteLength: number): string {
  const serialized = JSON.stringify(value);
  const currentLength = new TextEncoder().encode(serialized).byteLength;
  if (currentLength > byteLength) throw new Error("El fixture sintético excede la frontera solicitada.");
  return serialized + " ".repeat(byteLength - currentLength);
}

function withInheritedProperty<T>(field: string, value: unknown, action: () => T): T {
  const previousDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, field);
  Object.defineProperty(Object.prototype, field, {
    configurable: true,
    enumerable: false,
    writable: true,
    value
  });
  try {
    return action();
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(Object.prototype, field, previousDescriptor);
    } else {
      delete (Object.prototype as Record<string, unknown>)[field];
    }
  }
}

beforeEach(async () => {
  resetServerStore();
  await deleteStorageDatabase();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteStorageDatabase();
});

describe("validación estricta de inspecciones", () => {
  it("acepta una inspección sintética válida", () => {
    expect(validateInspection(validInspection)).toEqual({ success: true, data: validInspection });
  });

  it("recorta extremos y conserva los espacios internos", () => {
    const result = validateInspection({
      ...validInspection,
      location: "  Laboratorio   Sintético  ",
      inspector: "  Técnica   Sintética  ",
      summary: "  Revisión   sintética.  "
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location).toBe("Laboratorio   Sintético");
      expect(result.data.inspector).toBe("Técnica   Sintética");
      expect(result.data.summary).toBe("Revisión   sintética.");
    }
  });

  it("acepta los límites máximos documentados", () => {
    const result = validateInspection({
      ...validInspection,
      id: "i".repeat(INSPECTION_LIMITS.id),
      location: "l".repeat(INSPECTION_LIMITS.location),
      inspector: "r".repeat(INSPECTION_LIMITS.inspector),
      statusLabel: "e".repeat(INSPECTION_LIMITS.statusLabel),
      summary: "s".repeat(INSPECTION_LIMITS.summary),
      findings: INSPECTION_LIMITS.findingsMax
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["null", null],
    ["arreglo", []],
    ["texto", "inspection"],
    ["fecha como objeto", { ...validInspection, date: new Date() }],
    ["laboratorio como arreglo", { ...validInspection, location: ["Laboratorio"] }]
  ])("rechaza un valor principal o escalar de tipo incorrecto: %s", (_label, value) => {
    expect(validateInspection(value).success).toBe(false);
  });

  it("rechaza un campo obligatorio vacío", () => {
    const result = validateInspection({ ...validInspection, summary: "   " });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code: "required", field: "summary" })]) });
  });

  it("rechaza propiedades inesperadas", () => {
    const result = validateInspection({ ...validInspection, internalNote: "dato sintético" });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code: "unexpected_field", field: "internalNote" })]) });
  });

  it("rechaza un texto obligatorio heredado aunque tenga un valor válido", () => {
    const candidate: Record<string, unknown> = { ...validInspection };
    delete candidate.location;

    withInheritedProperty("location", "Laboratorio Sintético Heredado", () => {
      const result = validateInspection(candidate);
      expect(result).toMatchObject({
        success: false,
        issues: expect.arrayContaining([expect.objectContaining({ code: "required", field: "location" })])
      });
    });
  });

  it("rechaza status heredado", () => {
    const candidate: Record<string, unknown> = { ...validInspection };
    delete candidate.status;

    withInheritedProperty("status", "ok", () => {
      const result = validateInspection(candidate);
      expect(result).toMatchObject({
        success: false,
        issues: expect.arrayContaining([expect.objectContaining({ code: "required", field: "status" })])
      });
    });
  });

  it("rechaza findings heredado", () => {
    const candidate: Record<string, unknown> = { ...validInspection };
    delete candidate.findings;

    withInheritedProperty("findings", 0, () => {
      const result = validateInspection(candidate);
      expect(result).toMatchObject({
        success: false,
        issues: expect.arrayContaining([expect.objectContaining({ code: "required", field: "findings" })])
      });
    });
  });

  it("rechaza un operationId heredado en el sobre de transporte", () => {
    const candidate: Record<string, unknown> = { ...mutation() };
    delete candidate.operationId;

    withInheritedProperty("operationId", "operation-security-inherited", () => {
      const result = validateInspectionMutation(candidate);
      expect(result).toMatchObject({
        success: false,
        issues: expect.arrayContaining([expect.objectContaining({ code: "required", field: "operationId" })])
      });
    });
  });

  it("rechaza sync heredado en un StoredInspection", () => {
    const candidate = { ...validInspection };
    const inheritedSync = { status: "pending", baseRevision: null };

    withInheritedProperty("sync", inheritedSync, () => {
      expect(isStoredInspection(candidate)).toBe(false);
    });
  });

  it("acepta un StoredInspection normal con sync propio", () => {
    expect(
      isStoredInspection({
        ...validInspection,
        sync: { status: "pending", baseRevision: null, pendingOperationId: "operation-security-001" }
      })
    ).toBe(true);
  });

  it("rechaza una propiedad propia __proto__ creada mediante JSON.parse", () => {
    const candidate = JSON.parse(`{"__proto__":{},${JSON.stringify(validInspection).slice(1)}`) as unknown;
    const result = validateInspection(candidate);
    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "unexpected_field", field: "__proto__" })])
    });
  });

  it.each(["constructor", "prototype"])("rechaza la propiedad propia peligrosa %s", (field) => {
    const result = validateInspection({ ...validInspection, [field]: "valor sintético" });
    expect(result).toMatchObject({
      success: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: "unexpected_field", field })])
    });
  });

  it("rechaza un objeto literal cuyo __proto__ cambia el prototipo", () => {
    const candidate = { ...validInspection, __proto__: { source: "synthetic" } };
    expect(validateInspection(candidate)).toMatchObject({
      success: false,
      issues: [expect.objectContaining({ code: "invalid_type" })]
    });
  });

  it("rechaza texto que excede el límite", () => {
    const result = validateInspection({ ...validInspection, summary: "s".repeat(INSPECTION_LIMITS.summary + 1) });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code: "too_long", field: "summary" })]) });
  });

  it.each([
    ["01-11-2026", "invalid_format"],
    ["2026-2-03", "invalid_format"],
    ["2026-02-30", "invalid_date"],
    ["2025-02-29", "invalid_date"]
  ])("rechaza la fecha %s", (date, code) => {
    const result = validateInspection({ ...validInspection, date });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code, field: "date" })]) });
  });

  it("acepta una fecha bisiesta real sin conversiones de zona horaria", () => {
    expect(validateInspection({ ...validInspection, date: "2028-02-29" }).success).toBe(true);
  });

  it.each([
    ["negativo", -1, "out_of_range"],
    ["decimal", 1.5, "invalid_value"],
    ["NaN", Number.NaN, "invalid_type"],
    ["Infinity", Number.POSITIVE_INFINITY, "invalid_type"],
    ["sobre el máximo", INSPECTION_LIMITS.findingsMax + 1, "out_of_range"]
  ])("rechaza findings %s", (_label, findings, code) => {
    const result = validateInspection({ ...validInspection, findings });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code, field: "findings" })]) });
  });

  it("rechaza un valor fuera de la enumeración", () => {
    const result = validateInspection({ ...validInspection, status: "closed" });
    expect(result).toMatchObject({ success: false, issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_value", field: "status" })]) });
  });
});

describe("autoridad de validación en la API", () => {
  it("acepta application/json con charset y devuelve el payload normalizado", async () => {
    const payload = { ...validInspection, location: "  Laboratorio Sintético de Seguridad  " };
    const response = await POST(apiRequest(JSON.stringify(mutation(payload))));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inspection.location).toBe("Laboratorio Sintético de Seguridad");
  });

  it("acepta application/json sin parámetros", async () => {
    const response = await POST(apiRequest(JSON.stringify(mutation()), "application/json"));
    expect(response.status).toBe(200);
  });

  it("rechaza JSON malformado con un error seguro", async () => {
    const response = await POST(apiRequest('{"operationId":'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "JSON inválido." });
  });

  it("rechaza un Content-Type incompatible", async () => {
    const response = await POST(apiRequest(JSON.stringify(mutation()), "text/plain"));
    expect(response.status).toBe(415);
  });

  it("rechaza campos inesperados en el sobre HTTP", async () => {
    const response = await POST(apiRequest(JSON.stringify({ ...mutation(), extra: "sintético" })));
    expect(response.status).toBe(400);
  });

  it("permite que un cuerpo de exactamente 16 KiB supere la comprobación de tamaño", async () => {
    const exactBody = bodyWithExactByteLength(mutation(), MAX_INSPECTION_REQUEST_BYTES);
    expect(new TextEncoder().encode(exactBody)).toHaveLength(MAX_INSPECTION_REQUEST_BYTES);

    const response = await POST(apiRequest(exactBody));
    expect(response.status).toBe(200);
  });

  it("rechaza un cuerpo de 16 KiB más un byte", async () => {
    const oversized = bodyWithExactByteLength(mutation(), MAX_INSPECTION_REQUEST_BYTES + 1);
    expect(new TextEncoder().encode(oversized)).toHaveLength(MAX_INSPECTION_REQUEST_BYTES + 1);

    const response = await POST(apiRequest(oversized));
    expect(response.status).toBe(413);
  });

  it("mide caracteres multibyte por sus bytes UTF-8 reales", async () => {
    const multibyteBody = JSON.stringify({ ...mutation(), padding: "á".repeat(8200) });
    const encodedLength = new TextEncoder().encode(multibyteBody).byteLength;
    expect(multibyteBody.length).toBeLessThanOrEqual(MAX_INSPECTION_REQUEST_BYTES);
    expect(encodedLength).toBeGreaterThan(MAX_INSPECTION_REQUEST_BYTES);

    const response = await POST(apiRequest(multibyteBody));
    expect(response.status).toBe(413);
  });

  it("no expone detalles internos cuando falla la lectura", async () => {
    const internalDetail = "detalle-interno-sintetico-no-publicable";
    const request = {
      url: "http://localhost/api/inspecciones",
      headers: new Headers({ "Content-Type": "application/json" }),
      text: async () => {
        throw new Error(internalDetail);
      }
    } as Request;

    const response = await POST(request);
    const serialized = JSON.stringify(await response.json());
    expect(response.status).toBe(400);
    expect(serialized).not.toContain(internalDetail);
  });
});

describe("rechazo previo a la persistencia", () => {
  it("no deja una inspección ni una operación parcial cuando la captura es inválida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValueOnce("invalid-inspection").mockReturnValueOnce("invalid-operation")
    });
    render(createElement(InspeccionesPage));

    fireEvent.change(screen.getByLabelText("Resumen sintético"), { target: { value: "   " } });
    const form = screen.getByRole("button", { name: "Guardar sin conexión" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByText(/Revisa la inspección:/)).toBeInTheDocument();
    await expect(getAllInspections()).resolves.toEqual([]);
    await expect(getAllOutboxOperations()).resolves.toEqual([]);
  });
});

describe("controles de privacidad, encabezados y permisos", () => {
  beforeEach(async () => {
    await deleteStorageDatabase().catch(() => undefined);
    await deleteCapabilitiesDatabase().catch(() => undefined);
    if (typeof localStorage !== "undefined") localStorage.clear();
    if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  });

  afterEach(async () => {
    await deleteStorageDatabase().catch(() => undefined);
    await deleteCapabilitiesDatabase().catch(() => undefined);
    if (typeof localStorage !== "undefined") localStorage.clear();
    if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  });

  it("configura encabezados defensivos indispensables en next.config.mjs", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const configuredHeaders = await nextConfig.headers!();
    const globalRule = configuredHeaders.find((entry) => entry.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const headersMap = new Map(globalRule!.headers.map((h) => [h.key, h.value]));

    // 1. Content Security Policy compatible con Next.js 14
    expect(headersMap.has("Content-Security-Policy")).toBe(true);
    const csp = headersMap.get("Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("worker-src 'self'");

    // 2. X-Content-Type-Options: nosniff
    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");

    // 3. X-Frame-Options: DENY
    expect(headersMap.get("X-Frame-Options")).toBe("DENY");

    // 4. Referrer-Policy
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("establece una política de permisos coherente con las capacidades del proyecto", async () => {
    const configuredHeaders = await nextConfig.headers!();
    const globalRule = configuredHeaders.find((entry) => entry.source === "/(.*)");
    const headersMap = new Map(globalRule!.headers.map((h) => [h.key, h.value]));

    expect(headersMap.has("Permissions-Policy")).toBe(true);
    const permissions = headersMap.get("Permissions-Policy")!;

    // Micrófono deshabilitado totalmente
    expect(permissions).toContain("microphone=()");
    // Capacidades no usadas deshabilitadas
    expect(permissions).toContain("browsing-topics=()");
    expect(permissions).toContain("payment=()");
    expect(permissions).toContain("usb=()");
    // Cámara y geolocalización restringidas al origen propio
    expect(permissions).toContain("camera=(self)");
    expect(permissions).toContain("geolocation=(self)");
  });

  it("provee un archivo robots.txt válido con política estricta de no indexación", () => {
    const robotsPath = resolve(process.cwd(), "public", "robots.txt");
    expect(existsSync(robotsPath)).toBe(true);

    const content = readFileSync(robotsPath, "utf-8");
    expect(content).toMatch(/User-agent:\s*\*/i);
    expect(content).toMatch(/Disallow:\s*\//i);
  });

  it("no solicita permisos de cámara ni geolocalización automáticamente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const getUserMediaSpy = vi.fn();
    const getCurrentPositionSpy = vi.fn();

    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia: getUserMediaSpy },
      geolocation: { getCurrentPosition: getCurrentPositionSpy }
    });

    // Renderizar página no debe invocar las APIs de hardware
    render(createElement(InspeccionesPage));

    expect(getUserMediaSpy).not.toHaveBeenCalled();
    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });

  it("permite el guardado principal de la inspección incluso si se deniegan permisos de capacidades", async () => {
    const stored: StoredInspection = {
      ...validInspection,
      id: "inspection-no-cap-001",
      sync: {
        status: "pending",
        baseRevision: null,
        pendingOperationId: "operation-no-cap-001"
      }
    };

    const op: OutboxOperation = {
      operationId: "operation-no-cap-001",
      entityId: "inspection-no-cap-001",
      type: "create",
      payload: { ...validInspection, id: "inspection-no-cap-001" },
      baseRevision: null,
      attempts: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // El guardado principal nunca debe depender del almacenamiento de capacidades ni de permisos
    await expect(saveInspectionWithOperation(stored, op)).resolves.toBeUndefined();

    const saved = await getAllInspections();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("inspection-no-cap-001");

    const savedOps = await getAllOutboxOperations();
    expect(savedOps).toHaveLength(1);
    expect(savedOps[0].operationId).toBe("operation-no-cap-001");
  });

  it("rechaza datos auxiliares de capacidades dentro del payload de sincronización de la outbox", () => {
    const payloadWithAuxiliary = {
      ...validInspection,
      evidenceAttachment: {
        source: "synthetic-demo",
        mimeType: "image/png"
      },
      locationCoordinates: {
        latitude: 19.4326,
        longitude: -99.1332
      }
    };

    // validateInspection rechaza campos que no correspondan estrictamente a la lista permitida
    const result = validateInspection(payloadWithAuxiliary);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((i) => i.field === "evidenceAttachment")).toBe(true);
      expect(result.issues.some((i) => i.field === "locationCoordinates")).toBe(true);
    }

    // assertOutboxOperation rechaza mutaciones con payload inválido
    expect(() =>
      assertOutboxOperation({
        operationId: "op-aux-001",
        entityId: validInspection.id,
        type: "create",
        payload: payloadWithAuxiliary as unknown as typeof validInspection,
        baseRevision: null,
        attempts: 0,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    ).toThrow();
  });

  it("elimina de forma verificable todos los datos locales administrados por la aplicación", async () => {
    // 1. Guardar datos en IndexedDB principal
    const stored: StoredInspection = {
      ...validInspection,
      id: "inspection-to-purge-001",
      sync: {
        status: "pending",
        baseRevision: null,
        pendingOperationId: "op-to-purge-001"
      }
    };
    const op: OutboxOperation = {
      operationId: "op-to-purge-001",
      entityId: "inspection-to-purge-001",
      type: "create",
      payload: { ...validInspection, id: "inspection-to-purge-001" },
      baseRevision: null,
      attempts: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveInspectionWithOperation(stored, op);

    // 2. Guardar datos en IndexedDB de capacidades
    await saveInspectionCapabilities({
      inspectionId: "inspection-to-purge-001",
      location: {
        latitude: 19.43,
        longitude: -99.13,
        accuracy: 10,
        source: "synthetic-demo",
        capturedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    });

    // 3. Guardar datos en localStorage y sessionStorage
    localStorage.setItem("pwa-test-item", "sensible-local");
    sessionStorage.setItem("pwa-session-item", "sensible-session");

    expect(await getAllInspections()).toHaveLength(1);
    expect(await getAllOutboxOperations()).toHaveLength(1);
    expect(await getInspectionCapabilities("inspection-to-purge-001")).toBeDefined();
    expect(localStorage.getItem("pwa-test-item")).toBe("sensible-local");
    expect(sessionStorage.getItem("pwa-session-item")).toBe("sensible-session");

    // 4. Ejecutar la purga centralizada
    const report = await clearLocalApplicationData();

    expect(report.inspectionsStorage).toBe(true);
    expect(report.capabilitiesStorage).toBe(true);
    expect(report.cachesCleared).toBe(true);
    expect(report.webStorageCleared).toBe(true);
    expect(typeof report.purgedAt).toBe("string");

    // 5. Verificar que todo quedó limpio
    expect(await getAllInspections()).toEqual([]);
    expect(await getAllOutboxOperations()).toEqual([]);
    expect(localStorage.getItem("pwa-test-item")).toBeNull();
    expect(sessionStorage.getItem("pwa-session-item")).toBeNull();
  });
});
