/**
 * Almacenamiento auxiliar de capacidades (evidencia y ubicación) en IndexedDB.
 *
 * Base de datos acordada por el equipo en docs/capabilities.md:
 * - Nombre: `pwa-eq11-capabilities`
 * - Versión: 1
 * - Store: `inspection_capabilities`
 * - keyPath: `inspectionId`
 *
 * Se mantiene completamente separada de `pwa-eq11-inspections` (Semana 05)
 * para no alterar la outbox ni los esquemas existentes.
 */

import type {
  EvidenceAttachment,
  LocationAttachment,
  InspectionCapabilityRecord,
} from "@/lib/device/types";

// ── Constantes acordadas ──────────────────────────────────────────────

export const CAPABILITIES_DB_NAME = "pwa-eq11-capabilities";
export const CAPABILITIES_DB_VERSION = 1;
export const CAPABILITIES_STORE_NAME = "inspection_capabilities";

// Aliases para compatibilidad con código auxiliar
export const EVIDENCE_DB_NAME = CAPABILITIES_DB_NAME;
export const EVIDENCE_DB_VERSION = CAPABILITIES_DB_VERSION;
export const EVIDENCE_STORE_NAME = CAPABILITIES_STORE_NAME;

// ── Helpers de IndexedDB ──────────────────────────────────────────────

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falló una operación de IndexedDB."));
  });
}

function transactionCompleted(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("La transacción fue cancelada."));
    tx.onerror = () =>
      reject(tx.error ?? new Error("Falló la transacción."));
  });
}

// ── Conexión ──────────────────────────────────────────────────────────

export function openCapabilitiesDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB no está disponible en este entorno.")
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CAPABILITIES_DB_NAME, CAPABILITIES_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CAPABILITIES_STORE_NAME)) {
        db.createObjectStore(CAPABILITIES_STORE_NAME, {
          keyPath: "inspectionId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ??
          new Error("No se pudo abrir la base de datos de capacidades.")
      );
    request.onblocked = () =>
      reject(
        new Error(
          "La actualización de la base de capacidades está bloqueada."
        )
      );
  });
}

export const openEvidenceDatabase = openCapabilitiesDatabase;

export function closeCapabilitiesDatabase(db: IDBDatabase): void {
  db.close();
}

export const closeEvidenceDatabase = closeCapabilitiesDatabase;

export async function deleteCapabilitiesDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CAPABILITIES_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        request.error ??
          new Error("No se pudo eliminar la base de capacidades.")
      );
    request.onblocked = () =>
      reject(
        new Error(
          "No se puede eliminar la base mientras haya una conexión abierta."
        )
      );
  });
}

export const deleteEvidenceDatabase = deleteCapabilitiesDatabase;

// ── Operaciones CRUD públicas ─────────────────────────────────────────

type ConnectionArg = IDBDatabase | undefined;

async function withDb<T>(
  connection: ConnectionArg,
  action: (db: IDBDatabase) => Promise<T>
): Promise<T> {
  const db = connection ?? (await openCapabilitiesDatabase());
  try {
    return await action(db);
  } finally {
    if (!connection) db.close();
  }
}

/**
 * Guarda o actualiza el registro auxiliar de una inspección.
 */
export async function saveInspectionCapabilities(
  record: InspectionCapabilityRecord,
  connection?: IDBDatabase
): Promise<void> {
  if (!record.inspectionId?.trim()) {
    throw new TypeError("El identificador de inspección es obligatorio.");
  }
  await withDb(connection, async (db) => {
    const tx = db.transaction(CAPABILITIES_STORE_NAME, "readwrite");
    const done = transactionCompleted(tx);
    tx.objectStore(CAPABILITIES_STORE_NAME).put(record);
    await done;
  });
}

export const saveCapabilityRecord = saveInspectionCapabilities;

/**
 * Obtiene el registro auxiliar de una inspección, si existe.
 */
export async function getInspectionCapabilities(
  inspectionId: string,
  connection?: IDBDatabase
): Promise<InspectionCapabilityRecord | undefined> {
  if (!inspectionId?.trim()) {
    throw new TypeError("El identificador de inspección es obligatorio.");
  }
  return withDb(connection, async (db) => {
    const tx = db.transaction(CAPABILITIES_STORE_NAME, "readonly");
    return requestResult<InspectionCapabilityRecord | undefined>(
      tx.objectStore(CAPABILITIES_STORE_NAME).get(inspectionId)
    );
  });
}

export const getCapabilityRecord = getInspectionCapabilities;

/**
 * Elimina el registro auxiliar de una inspección.
 */
export async function deleteInspectionCapabilities(
  inspectionId: string,
  connection?: IDBDatabase
): Promise<void> {
  if (!inspectionId?.trim()) {
    throw new TypeError("El identificador de inspección es obligatorio.");
  }
  await withDb(connection, async (db) => {
    const tx = db.transaction(CAPABILITIES_STORE_NAME, "readwrite");
    const done = transactionCompleted(tx);
    tx.objectStore(CAPABILITIES_STORE_NAME).delete(inspectionId);
    await done;
  });
}

export const deleteCapabilityRecord = deleteInspectionCapabilities;

/**
 * Lista todos los registros auxiliares.
 */
export async function getAllCapabilityRecords(
  connection?: IDBDatabase
): Promise<InspectionCapabilityRecord[]> {
  return withDb(connection, async (db) => {
    const tx = db.transaction(CAPABILITIES_STORE_NAME, "readonly");
    return requestResult<InspectionCapabilityRecord[]>(
      tx.objectStore(CAPABILITIES_STORE_NAME).getAll()
    );
  });
}

// ── Helpers de actualización parcial ──────────────────────────────────

/**
 * Agrega o reemplaza la evidencia fotográfica de una inspección
 * sin alterar la ubicación previamente almacenada.
 */
export async function saveEvidence(
  inspectionId: string,
  evidence: EvidenceAttachment,
  connection?: IDBDatabase
): Promise<void> {
  const existing = await getInspectionCapabilities(inspectionId, connection);
  const now = new Date().toISOString();
  const record: InspectionCapabilityRecord = {
    inspectionId,
    evidence,
    location: existing?.location,
    updatedAt: now,
  };
  await saveInspectionCapabilities(record, connection);
}

/**
 * Agrega o reemplaza la ubicación de una inspección sin alterar
 * la evidencia fotográfica previamente almacenada.
 */
export async function saveLocation(
  inspectionId: string,
  location: LocationAttachment,
  connection?: IDBDatabase
): Promise<void> {
  const existing = await getInspectionCapabilities(inspectionId, connection);
  const now = new Date().toISOString();
  const record: InspectionCapabilityRecord = {
    inspectionId,
    evidence: existing?.evidence,
    location,
    updatedAt: now,
  };
  await saveInspectionCapabilities(record, connection);
}

/**
 * Elimina solo la evidencia fotográfica, conservando la ubicación.
 */
export async function removeEvidence(
  inspectionId: string,
  connection?: IDBDatabase
): Promise<void> {
  const existing = await getInspectionCapabilities(inspectionId, connection);
  if (!existing) return;

  if (!existing.location) {
    await deleteInspectionCapabilities(inspectionId, connection);
    return;
  }

  const record: InspectionCapabilityRecord = {
    inspectionId,
    location: existing.location,
    updatedAt: new Date().toISOString(),
  };
  await saveInspectionCapabilities(record, connection);
}

/**
 * Elimina solo la ubicación, conservando la evidencia fotográfica.
 */
export async function removeLocation(
  inspectionId: string,
  connection?: IDBDatabase
): Promise<void> {
  const existing = await getInspectionCapabilities(inspectionId, connection);
  if (!existing) return;

  if (!existing.evidence) {
    await deleteInspectionCapabilities(inspectionId, connection);
    return;
  }

  const record: InspectionCapabilityRecord = {
    inspectionId,
    evidence: existing.evidence,
    updatedAt: new Date().toISOString(),
  };
  await saveInspectionCapabilities(record, connection);
}
