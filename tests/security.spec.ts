import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/inspecciones/route";
import {
  INSPECTION_LIMITS,
  MAX_INSPECTION_REQUEST_BYTES,
  validateInspection
} from "@/lib/security";
import { resetServerStore } from "@/lib/sync/api-store";

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

beforeEach(() => resetServerStore());

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
  it("acepta JSON sintético válido y devuelve el payload normalizado", async () => {
    const payload = { ...validInspection, location: "  Laboratorio Sintético de Seguridad  " };
    const response = await POST(apiRequest(JSON.stringify(mutation(payload))));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inspection.location).toBe("Laboratorio Sintético de Seguridad");
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

  it("rechaza un cuerpo que excede el límite antes de procesarlo", async () => {
    const oversized = JSON.stringify({ ...mutation(), padding: "x".repeat(MAX_INSPECTION_REQUEST_BYTES) });
    const response = await POST(apiRequest(oversized));
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
