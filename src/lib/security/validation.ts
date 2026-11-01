import type { Inspection, InspectionStatus } from "@/lib/data/inspections";

/** Límites del dominio; cuentan unidades de código JavaScript después de trim(). */
export const INSPECTION_LIMITS = {
  id: 128,
  location: 120,
  inspector: 100,
  statusLabel: 64,
  summary: 1000,
  findingsMax: 1000,
  operationId: 200
} as const;

/** Límite de aplicación previo al parseo; el proxy de despliegue debe imponer su propio límite. */
export const MAX_INSPECTION_REQUEST_BYTES = 16 * 1024;

export const INSPECTION_FIELDS = [
  "id",
  "location",
  "date",
  "inspector",
  "status",
  "statusLabel",
  "findings",
  "summary"
] as const;

const MUTATION_FIELDS = ["operationId", "entityId", "type", "payload", "baseRevision"] as const;

export type ValidationIssueCode =
  | "invalid_type"
  | "required"
  | "too_long"
  | "unexpected_field"
  | "invalid_format"
  | "invalid_date"
  | "invalid_value"
  | "out_of_range";

export type ValidationIssue = Readonly<{
  code: ValidationIssueCode;
  field?: string;
  message: string;
}>;

export type ValidationResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; issues: readonly ValidationIssue[] }>;

export type InspectionMutation = Readonly<{
  operationId: string;
  entityId: string;
  type: "create" | "update";
  payload: Inspection;
  baseRevision: number | null;
}>;

type PlainRecord = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnexpectedFields(record: PlainRecord, allowed: readonly string[], issues: ValidationIssue[]): void {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(record)) {
    if (!allowedFields.has(field)) {
      issues.push({ code: "unexpected_field", field, message: "La entrada contiene un campo no permitido." });
    }
  }
}

function validateText(
  record: PlainRecord,
  field: string,
  maxLength: number,
  issues: ValidationIssue[]
): string | undefined {
  const value = record[field];
  if (typeof value !== "string") {
    issues.push({ code: "invalid_type", field, message: `El campo ${field} debe ser texto.` });
    return undefined;
  }

  // Solo se eliminan espacios de los extremos. Los espacios internos se conservan intencionalmente.
  const normalized = value.trim();
  if (normalized.length === 0) {
    issues.push({ code: "required", field, message: `El campo ${field} es obligatorio.` });
  } else if (normalized.length > maxLength) {
    issues.push({ code: "too_long", field, message: `El campo ${field} excede la longitud permitida.` });
  }
  return normalized;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isExistingCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function validateInspection(value: unknown): ValidationResult<Inspection> {
  if (!isPlainObject(value)) {
    return {
      success: false,
      issues: [{ code: "invalid_type", message: "La inspección debe ser un objeto plano." }]
    };
  }

  const issues: ValidationIssue[] = [];
  rejectUnexpectedFields(value, INSPECTION_FIELDS, issues);

  const id = validateText(value, "id", INSPECTION_LIMITS.id, issues);
  const location = validateText(value, "location", INSPECTION_LIMITS.location, issues);
  const date = validateText(value, "date", 10, issues);
  const inspector = validateText(value, "inspector", INSPECTION_LIMITS.inspector, issues);
  const statusLabel = validateText(value, "statusLabel", INSPECTION_LIMITS.statusLabel, issues);
  const summary = validateText(value, "summary", INSPECTION_LIMITS.summary, issues);

  let status: InspectionStatus | undefined;
  if (value.status !== "ok" && value.status !== "attention") {
    issues.push({ code: "invalid_value", field: "status", message: "El estado de la inspección no está permitido." });
  } else {
    status = value.status;
  }

  let findings: number | undefined;
  if (typeof value.findings !== "number" || !Number.isFinite(value.findings)) {
    issues.push({ code: "invalid_type", field: "findings", message: "Los hallazgos deben ser un número finito." });
  } else if (!Number.isInteger(value.findings)) {
    issues.push({ code: "invalid_value", field: "findings", message: "Los hallazgos deben ser un número entero." });
  } else if (value.findings < 0 || value.findings > INSPECTION_LIMITS.findingsMax) {
    issues.push({ code: "out_of_range", field: "findings", message: "Los hallazgos están fuera del rango permitido." });
  } else {
    findings = value.findings;
  }

  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      issues.push({ code: "invalid_format", field: "date", message: "La fecha debe usar el formato YYYY-MM-DD." });
    } else if (!isExistingCalendarDate(date)) {
      issues.push({ code: "invalid_date", field: "date", message: "La fecha no existe en el calendario." });
    }
  }

  if (
    issues.length > 0 ||
    id === undefined ||
    location === undefined ||
    date === undefined ||
    inspector === undefined ||
    status === undefined ||
    statusLabel === undefined ||
    findings === undefined ||
    summary === undefined
  ) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: { id, location, date, inspector, status, statusLabel, findings, summary }
  };
}

export function validateInspectionMutation(value: unknown): ValidationResult<InspectionMutation> {
  if (!isPlainObject(value)) {
    return {
      success: false,
      issues: [{ code: "invalid_type", message: "La mutación debe ser un objeto plano." }]
    };
  }

  const issues: ValidationIssue[] = [];
  rejectUnexpectedFields(value, MUTATION_FIELDS, issues);
  const operationId = validateText(value, "operationId", INSPECTION_LIMITS.operationId, issues);
  const entityId = validateText(value, "entityId", INSPECTION_LIMITS.id, issues);
  const payloadResult = validateInspection(value.payload);
  if (!payloadResult.success) {
    issues.push(
      ...payloadResult.issues.map((issue) => ({
        ...issue,
        field: issue.field ? `payload.${issue.field}` : "payload"
      }))
    );
  }

  let type: "create" | "update" | undefined;
  if (value.type !== "create" && value.type !== "update") {
    issues.push({ code: "invalid_value", field: "type", message: "El tipo de mutación no está permitido." });
  } else {
    type = value.type;
  }

  let baseRevision: number | null | undefined;
  if (value.baseRevision === null) {
    baseRevision = null;
  } else if (
    typeof value.baseRevision !== "number" ||
    !Number.isFinite(value.baseRevision) ||
    !Number.isSafeInteger(value.baseRevision) ||
    value.baseRevision < 0
  ) {
    issues.push({ code: "invalid_value", field: "baseRevision", message: "La revisión base no es válida." });
  } else {
    baseRevision = value.baseRevision;
  }

  if (payloadResult.success && entityId !== undefined && payloadResult.data.id !== entityId) {
    issues.push({ code: "invalid_value", field: "entityId", message: "La entidad no coincide con la inspección." });
  }

  if (
    issues.length > 0 ||
    operationId === undefined ||
    entityId === undefined ||
    type === undefined ||
    !payloadResult.success ||
    baseRevision === undefined
  ) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: { operationId, entityId, type, payload: payloadResult.data, baseRevision }
  };
}
