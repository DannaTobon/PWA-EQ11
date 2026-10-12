import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  openEvidenceDatabase,
  closeEvidenceDatabase,
  deleteEvidenceDatabase,
  saveCapabilityRecord,
  getCapabilityRecord,
  getAllCapabilityRecords,
  deleteCapabilityRecord,
  saveEvidence,
  saveLocation,
  removeEvidence,
  removeLocation,
  CAPABILITIES_DB_NAME,
  CAPABILITIES_STORE_NAME,
} from "@/lib/device/evidence-storage";
import type {
  InspectionCapabilityRecord,
  EvidenceAttachment,
  LocationAttachment,
} from "@/lib/device/types";

// ── Fixtures sintéticos ──────────────────────────────────────────────

const INSPECTION_ID = "local-inspection-test-001";
const NOW = "2026-10-11T12:00:00.000Z";

const syntheticEvidence: EvidenceAttachment = {
  source: "synthetic-demo",
  blob: new Blob(["synthetic-image-data"], { type: "image/jpeg" }),
  mimeType: "image/jpeg",
  capturedAt: NOW,
};

const syntheticLocation: LocationAttachment = {
  source: "synthetic-demo",
  latitude: 19.4326,
  longitude: -99.1332,
  accuracyMeters: 50,
  capturedAt: NOW,
};

const fullRecord: InspectionCapabilityRecord = {
  inspectionId: INSPECTION_ID,
  evidence: syntheticEvidence,
  location: syntheticLocation,
  updatedAt: NOW,
};

// ── Suite ─────────────────────────────────────────────────────────────

describe("almacenamiento auxiliar de evidencia", () => {
  beforeEach(async () => {
    await deleteEvidenceDatabase();
  });

  afterEach(async () => {
    await deleteEvidenceDatabase();
  });

  // ── CRUD básico ────────────────────────────────────────────────────

  it("guarda y recupera un registro completo", async () => {
    await saveCapabilityRecord(fullRecord);
    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeDefined();
    expect(restored!.inspectionId).toBe(INSPECTION_ID);
    expect(restored!.location?.latitude).toBe(syntheticLocation.latitude);
  });

  it("conserva el registro después de cerrar y reabrir la base", async () => {
    const db = await openEvidenceDatabase();
    await saveCapabilityRecord(fullRecord, db);
    closeEvidenceDatabase(db);

    const db2 = await openEvidenceDatabase();
    const restored = await getCapabilityRecord(INSPECTION_ID, db2);
    closeEvidenceDatabase(db2);

    expect(restored).toBeDefined();
    expect(restored!.inspectionId).toBe(INSPECTION_ID);
  });

  it("lista todos los registros", async () => {
    await saveCapabilityRecord(fullRecord);
    await saveCapabilityRecord({
      inspectionId: "local-inspection-test-002",
      evidence: syntheticEvidence,
      updatedAt: NOW,
    });

    const all = await getAllCapabilityRecords();
    expect(all).toHaveLength(2);
  });

  it("elimina un registro por inspectionId", async () => {
    await saveCapabilityRecord(fullRecord);
    await deleteCapabilityRecord(INSPECTION_ID);
    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeUndefined();
  });

  it("devuelve undefined para un registro inexistente", async () => {
    const restored = await getCapabilityRecord("id-inexistente");
    expect(restored).toBeUndefined();
  });

  it("rechaza un inspectionId vacío", async () => {
    await expect(
      saveCapabilityRecord({ ...fullRecord, inspectionId: "" })
    ).rejects.toThrow(TypeError);
  });

  // ── Actualización parcial ──────────────────────────────────────────

  it("guarda evidencia sin perder la ubicación previa", async () => {
    await saveCapabilityRecord(fullRecord);

    const newEvidence: EvidenceAttachment = {
      source: "synthetic-demo",
      blob: new Blob(["nueva-evidencia"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
      capturedAt: "2026-10-11T13:00:00.000Z",
    };

    await saveEvidence(INSPECTION_ID, newEvidence);

    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeDefined();
    expect(restored!.evidence?.capturedAt).toBe("2026-10-11T13:00:00.000Z");
    expect(restored!.location?.latitude).toBe(syntheticLocation.latitude);
  });

  it("guarda ubicación sin perder la evidencia previa", async () => {
    await saveCapabilityRecord(fullRecord);

    const newLocation: LocationAttachment = {
      source: "synthetic-demo",
      latitude: 20.0,
      longitude: -100.0,
      accuracyMeters: 30,
      capturedAt: "2026-10-11T13:00:00.000Z",
    };

    await saveLocation(INSPECTION_ID, newLocation);

    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeDefined();
    expect(restored!.location?.latitude).toBe(20.0);
    expect(restored!.evidence?.mimeType).toBe("image/jpeg");
  });

  // ── Eliminación parcial ────────────────────────────────────────────

  it("quita solo la evidencia y conserva la ubicación", async () => {
    await saveCapabilityRecord(fullRecord);
    await removeEvidence(INSPECTION_ID);

    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeDefined();
    expect(restored!.evidence).toBeUndefined();
    expect(restored!.location?.latitude).toBe(syntheticLocation.latitude);
  });

  it("quita solo la ubicación y conserva la evidencia", async () => {
    await saveCapabilityRecord(fullRecord);
    await removeLocation(INSPECTION_ID);

    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeDefined();
    expect(restored!.location).toBeUndefined();
    expect(restored!.evidence?.mimeType).toBe("image/jpeg");
  });

  it("elimina el registro completo si se quita el último campo", async () => {
    const onlyEvidence: InspectionCapabilityRecord = {
      inspectionId: INSPECTION_ID,
      evidence: syntheticEvidence,
      updatedAt: NOW,
    };
    await saveCapabilityRecord(onlyEvidence);
    await removeEvidence(INSPECTION_ID);

    const restored = await getCapabilityRecord(INSPECTION_ID);
    expect(restored).toBeUndefined();
  });

  // ── Compatibilidad con almacenamiento previo (no invasión) ─────────

  it("no altera la base de inspecciones de Semana 05", async () => {
    // Verificar que la base auxiliar es independiente
    const db = await openEvidenceDatabase();
    try {
      expect(db.name).toBe(CAPABILITIES_DB_NAME);
      expect(db.objectStoreNames.contains(CAPABILITIES_STORE_NAME)).toBe(true);
      // No debe tener los stores de la base principal
      expect(db.objectStoreNames.contains("inspections")).toBe(false);
      expect(db.objectStoreNames.contains("outbox")).toBe(false);
      expect(db.objectStoreNames.contains("sync_meta")).toBe(false);
    } finally {
      closeEvidenceDatabase(db);
    }
  });
});

