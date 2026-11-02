import "fake-indexeddb/auto";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/inspecciones/route";
import InspeccionesPage from "@/app/inspecciones/page";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import nextConfig from "../next.config.mjs";
import { formatFindings, scanRepository, scanText } from "../scripts/scan-secrets.mjs";
import { enqueue, processQueue } from "@/lib/sync/queue";
import {
  INSPECTION_LIMITS,
  MAX_INSPECTION_REQUEST_BYTES,
  MAX_SAFE_MESSAGE_LENGTH,
  clearLocalApplicationData,
  describePayload,
  redactSensitiveText,
  redactSensitiveValue,
  safeErrorMessage,
  validateInspection,
  validateInspectionMutation
} from "@/lib/security";
import {
  deleteStorageDatabase,
  getAllInspections,
  getAllOutboxOperations,
  saveInspectionWithOperation,
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
    } as unknown as Request;

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


// Semana 09 — Tonanzin: redacción, escáner de credenciales y modelo de amenazas
// Todos los valores sensibles se construyen en tiempo de ejecución a partir de
// fragmentos sintéticos: así este archivo no contiene credenciales completas y el
// propio escáner no lo marca.
// ---------------------------------------------------------------------------
const syntheticToken = ["ghp", "_", "a1B2".repeat(9)].join("");
const syntheticJwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJzaW50ZXRpY28ifQ", "c2lnbmF0dXJhU2ludGV0aWNh"].join(".");
const syntheticPrivateKey = [
  ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
  "MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAsintetico",
  ["-----END", "PRIVATE KEY-----"].join(" ")
].join("\n");
const syntheticAwsKey = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
const syntheticSlackToken = ["xoxb", "1234567890", "abcdefghijkl"].join("-");

const syntheticCredentials: Record<string, string> = {
  "private-key": syntheticPrivateKey,
  jwt: syntheticJwt,
  "github-token": syntheticToken,
  "aws-access-key": syntheticAwsKey,
  "slack-token": syntheticSlackToken
};

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("redacción, escáner de credenciales y modelo de amenazas (Semana 09)", () => {
  it("redacta credenciales con formato real de forma que el valor no aparece en la salida", () => {
    for (const [category, value] of Object.entries(syntheticCredentials)) {
      const output = redactSensitiveText(`fallo al procesar (${category}): ${value} fin`);
      expect(output, category).not.toContain(value);
      expect(output, category).toContain("[REDACTED");
    }
  });

  it("redacta campos sensibles en texto, consultas y JSON conservando el formato", () => {
    expect(redactSensitiveText("GET /api?token=valor-sintetico-1&pagina=2")).toBe("GET /api?token=[REDACTED]&pagina=2");
    expect(redactSensitiveText("Authorization: Bearer abcdefgh12345678")).toBe("Authorization: [REDACTED]");

    const json = redactSensitiveText('{"password":"clave-sintetica","estado":"ok"}');
    expect(json).not.toContain("clave-sintetica");
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual({ password: "[REDACTED]", estado: "ok" });
  });

  it("redacta fotos en base64, coordenadas y correos", () => {
    const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHg==";
    const output = redactSensitiveText(`foto ${photo} en {"latitude": 19.4326, "lng": -99.1332} de tecnico.sintetico@ejemplo.test`);
    expect(output).not.toContain("iVBORw0KGgo");
    expect(output).not.toContain("19.4326");
    expect(output).not.toContain("-99.1332");
    expect(output).not.toContain("tecnico.sintetico@ejemplo.test");

    const redacted = redactSensitiveValue({ inspectionId: "insp-1", photo, latitude: 19.4326, longitude: -99.1332, accuracy: 12 });
    expect(redacted).toEqual({ inspectionId: "insp-1", photo: "[REDACTED]", latitude: "[REDACTED]", longitude: "[REDACTED]", accuracy: "[REDACTED]" });
  });

  it("conserva mensajes seguros y útiles", () => {
    const messages = [
      "HTTP 503",
      "Failed to fetch",
      "Conflicto de revisión.",
      "JSON inválido.",
      "El token es inválido",
      "La inspección no existe en el servidor.",
      "Campo lat/lon omitido por el usuario"
    ];
    for (const message of messages) {
      expect(redactSensitiveText(message)).toBe(message);
      expect(safeErrorMessage(new Error(message))).toBe(message);
    }
  });

  it("redactSensitiveValue enmascara claves sensibles, tolera ciclos y no copia la pila de los errores", () => {
    const circular: Record<string, unknown> = { nombre: "sintético" };
    circular.self = circular;
    expect(redactSensitiveValue(circular)).toEqual({ nombre: "sintético", self: "[Circular]" });

    const input = { id: "x", nested: { apiKey: "valor-sintetico", lista: [{ token: "otro-valor" }], ok: 1 } };
    const copy = redactSensitiveValue(input);
    expect(copy).toEqual({ id: "x", nested: { apiKey: "[REDACTED]", lista: [{ token: "[REDACTED]" }], ok: 1 } });
    expect(input.nested.apiKey).toBe("valor-sintetico"); // no modifica la entrada

    const error = new Error(`fallo con ${syntheticToken}`);
    const serialized = JSON.stringify(redactSensitiveValue({ error }));
    expect(serialized).not.toContain(syntheticToken);
    expect(serialized).not.toContain("stack");
  });

  it("safeErrorMessage usa solo el mensaje, lo acota y recurre al texto genérico", () => {
    expect(safeErrorMessage(new Error(`red caída ${syntheticJwt}`))).not.toContain(syntheticJwt);
    expect(safeErrorMessage({ message: "Bearer abcdefghij12345" })).toBe("Bearer [REDACTED]");
    expect(safeErrorMessage("texto suelto")).toBe("Ha ocurrido un error inesperado.");
    expect(safeErrorMessage(new Error("   "), "mensaje de respaldo")).toBe("mensaje de respaldo");
    expect(safeErrorMessage(new Error("x".repeat(1000))).length).toBeLessThanOrEqual(MAX_SAFE_MESSAGE_LENGTH);
  });

  it("el valor sensible no llega a lastError de la outbox cuando el envío falla", async () => {
    await deleteStorageDatabase();
    const operation: OutboxOperation = {
      operationId: "op-redaccion-001",
      entityId: validInspection.id,
      type: "create",
      payload: validInspection,
      baseRevision: null,
      attempts: 0,
      status: "pending",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z"
    };
    await enqueue(operation);
    await processQueue({
      send: async () => {
        throw new Error(`fallo de red hacia https://ejemplo.test/api?token=${syntheticToken}`);
      },
      sleep: async () => undefined,
      retry: { maxRetries: 0, backoffMs: [1] }
    });

    const stored = (await getAllOutboxOperations()).find((candidate) => candidate.operationId === "op-redaccion-001");
    expect(stored?.lastError).toBeDefined();
    expect(stored?.lastError).not.toContain(syntheticToken);
    expect(stored?.lastError).toContain("[REDACTED");
    await deleteStorageDatabase();
  });

  it("el escáner detecta fixtures sintéticos de alta confianza y no imprime el valor", () => {
    for (const [category, value] of Object.entries(syntheticCredentials)) {
      const findings = scanText(`línea previa\nvalor: ${value}\nlínea final`);
      expect(findings.map((finding) => finding.category), category).toContain(category);
      const serialized = JSON.stringify(findings);
      expect(serialized, category).not.toContain(value);
    }

    const located = scanText(`uno\ndos\n${syntheticToken}\n`);
    expect(located).toEqual([{ line: 3, category: "github-token" }]);
    expect(Object.keys(located[0]).sort()).toEqual(["category", "line"]);

    const report = formatFindings([{ file: "docs/ejemplo.md", line: 7, category: "jwt" }]);
    expect(report).toBe("docs/ejemplo.md:7  categoría=jwt  valor=[REDACTED]");
  });

  it("el escáner no genera falsos positivos con palabras genéricas ni nombres de paquetes", () => {
    const benign = [
      "const password = process.env.NOT_USED;",
      "Se documenta el uso de un secret manager y de un token de sesión.",
      "El campo apiKey no contiene ningún valor.",
      "npm install sk-learn-utils ghp-helper eyJ-no-es-un-jwt",
      '"name": "@types/node", "version": "20.14.15"',
      "npm_config_registry=https://registry.npmjs.org/",
      "AKIA corto",
      "-----BEGIN CERTIFICATE-----",
      "sha512-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/AbCdEf=="
    ];
    for (const text of benign) {
      expect(scanText(text), text).toEqual([]);
    }
  });

  it("el escáner no marca el contenido normal del lockfile ni del repositorio", () => {
    const root = process.cwd();
    const lockfile = readFileSync(resolve(root, "package-lock.json"), "utf-8");
    expect(scanText(lockfile)).toEqual([]);

    const result = scanRepository(root);
    expect(result.scannedFiles).toBeGreaterThan(20);
    expect(result.findings).toEqual([]);
  });

  it("el escáner y la redacción reconocen las mismas categorías sintéticas", () => {
    for (const [category, value] of Object.entries(syntheticCredentials)) {
      expect(scanText(value).length, `scanner ${category}`).toBeGreaterThan(0);
      expect(redactSensitiveText(value), `redacción ${category}`).not.toContain(value.split("\n")[1] ?? value);
      expect(redactSensitiveText(value), `redacción ${category}`).toContain("[REDACTED");
    }
  });

  it("scripts/verify.mjs ejecuta el escáner como check obligatorio", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts", "verify.mjs"), "utf-8");
    expect(script).toContain('from "./scan-secrets.mjs"');
    expect(script).toContain("scanRepository(root)");
    expect(script).toMatch(/id:\s*"secrets"/);
    expect(script).toContain("scripts/scan-secrets.mjs");
    expect(script).toContain("docs/threat-model.md");
  });

  it("el workflow de CI fija Node 20.19.6 e instala con npm ci --ignore-scripts", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github", "workflows", "academic-evaluation.yml"), "utf-8");
    const nvmrc = readFileSync(resolve(process.cwd(), ".nvmrc"), "utf-8").trim();
    expect(nvmrc).toBe("20.19.6");
    expect(workflow).toContain(`node-version: "${nvmrc}"`);
    expect(workflow).toContain("npm ci --ignore-scripts --no-audit --no-fund");
    expect(workflow).toContain("npm run scan:secrets");
    expect(workflow).toContain("npm run verify:full");
    expect(workflow).toMatch(/permissions:\s*\n\s+contents:\s*read/);
  });

  it("el código fuente no usa sinks HTML crudos (dangerouslySetInnerHTML, innerHTML, eval)", () => {
    const forbidden = /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new Function\s*\(/;
    const offenders = listSourceFiles(resolve(process.cwd(), "src")).filter((file) => forbidden.test(readFileSync(file, "utf-8")));
    expect(offenders).toEqual([]);
  });

  it("conserva marcado HTML como texto literal sin interpretarlo", () => {
    const markup = "<img src=x onerror=alert(1)> y <script>alert(1)</script>";
    const result = validateInspection({ ...validInspection, summary: markup });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.summary).toBe(markup);
  });

  describe("modelo de amenazas", () => {
    const threatModel = readFileSync(resolve(process.cwd(), "docs", "threat-model.md"), "utf-8");
    const rows = threatModel.split("\n").filter((line) => /^\| T-\d{2} \|/.test(line));

    it("cada control del modelo de amenazas referencia pruebas y archivos que existen", () => {
      expect(rows.length).toBeGreaterThanOrEqual(14);
      const root = process.cwd();
      const titleOf = (file: string): string => readFileSync(resolve(root, file), "utf-8");

      for (const row of rows) {
        const id = row.split("|")[1].trim();
        const cells = row.split("|").map((cell) => cell.trim());
        const testCell = cells[7];
        const controlCell = cells[6];

        const references = [...testCell.matchAll(/`(tests\/[\w./-]+) › ([^`]+)`/g)];
        if (references.length === 0) {
          expect(testCell, `${id} sin prueba debe declararlo`).toMatch(/^Ninguna/);
        }
        for (const [, file, title] of references) {
          expect(existsSync(resolve(root, file)), `${id}: falta ${file}`).toBe(true);
          const source = titleOf(file);
          const found = source.includes(`it("${title}"`) || source.includes(`it('${title}'`) || source.includes(`it(\`${title}\``);
          expect(found, `${id}: no existe la prueba "${title}" en ${file}`).toBe(true);
        }
        for (const [, path] of controlCell.matchAll(/`((?:src|public|scripts|docs|\.github)\/[^`\s]+)`/g)) {
          expect(existsSync(resolve(root, path)), `${id}: falta el archivo ${path}`).toBe(true);
        }
      }
    });

    it("el modelo de amenazas cubre las amenazas mínimas exigidas y la metodología STRIDE", () => {
      const lower = threatModel.toLowerCase();
      const required = [
        "entrada maliciosa", "xss", "indexeddb", "caché", "foto", "permisos excesivos", "replay",
        "conflictos de sincronización", "api sin autenticación", "dependencia comprometida",
        "credencial versionada", "despliegue sin https", "acceso físico", "borrado incompleto"
      ];
      for (const topic of required) expect(lower, topic).toContain(topic);

      for (const category of ["spoofing", "tampering", "repudiation", "information disclosure", "denial of service", "elevation of privilege"]) {
        expect(lower, category).toContain(category);
      }
      for (const section of ["alcance y exclusiones", "activos protegidos", "actores", "flujos de datos", "fronteras de confianza", "riesgo residual"]) {
        expect(lower, section).toContain(section);
      }
    });
  });
});
