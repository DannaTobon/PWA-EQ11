import "fake-indexeddb/auto";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/inspecciones/route";
import InspeccionesPage from "@/app/inspecciones/page";
import {
  INSPECTION_LIMITS,
  MAX_INSPECTION_REQUEST_BYTES,
  validateInspection,
  validateInspectionMutation
} from "@/lib/security";
import {
  deleteStorageDatabase,
  getAllInspections,
  getAllOutboxOperations
} from "@/lib/storage/indexeddb";
import { isStoredInspection } from "@/lib/storage/schema";
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
