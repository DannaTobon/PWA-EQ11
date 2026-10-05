import {
  STORAGE_DATABASE_NAME,
  STORAGE_DATABASE_VERSION,
  STORAGE_STORES,
  assertOutboxOperation,
  assertStoredInspection,
  type OutboxOperation,
  type StoredInspection,
  type SyncMetaRecord
} from "@/lib/storage/schema";

type DatabaseConnection = IDBDatabase | undefined;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falló una operación de IndexedDB."));
  });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("La transacción de IndexedDB fue cancelada."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Falló una transacción de IndexedDB."));
  });
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }
  return indexedDB;
}

export function openStorageDatabase(): Promise<IDBDatabase> {
  const factory = requireIndexedDb();

  return new Promise((resolve, reject) => {
    const request = factory.open(STORAGE_DATABASE_NAME, STORAGE_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORAGE_STORES.inspections)) {
        database.createObjectStore(STORAGE_STORES.inspections, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(STORAGE_STORES.outbox)) {
        const outbox = database.createObjectStore(STORAGE_STORES.outbox, { keyPath: "operationId" });
        outbox.createIndex("entityId", "entityId", { unique: false });
        outbox.createIndex("status", "status", { unique: false });
      }

      if (!database.objectStoreNames.contains(STORAGE_STORES.syncMeta)) {
        database.createObjectStore(STORAGE_STORES.syncMeta, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la base local."));
    request.onblocked = () => reject(new Error("La actualización de la base local está bloqueada por otra pestaña."));
  });
}

async function useDatabase<T>(connection: DatabaseConnection, action: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = connection ?? (await openStorageDatabase());
  try {
    return await action(database);
  } finally {
    if (!connection) database.close();
  }
}

export function closeStorageDatabase(database: IDBDatabase): void {
  database.close();
}

export async function deleteStorageDatabase(): Promise<void> {
  const factory = requireIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(STORAGE_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("No se pudo eliminar la base local."));
    request.onblocked = () => reject(new Error("No se puede eliminar la base mientras exista una conexión abierta."));
  });
}

export async function saveInspection(inspection: StoredInspection, connection?: IDBDatabase): Promise<void> {
  assertStoredInspection(inspection);
  await useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.inspections, "readwrite");
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORAGE_STORES.inspections).put(inspection);
    await completed;
  });
}

export const updateInspection = saveInspection;

export async function getInspection(entityId: string, connection?: IDBDatabase): Promise<StoredInspection | undefined> {
  if (!entityId.trim()) throw new TypeError("El identificador de inspección es obligatorio.");
  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.inspections, "readonly");
    return requestResult<StoredInspection | undefined>(
      transaction.objectStore(STORAGE_STORES.inspections).get(entityId)
    );
  });
}

export async function getAllInspections(connection?: IDBDatabase): Promise<StoredInspection[]> {
  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.inspections, "readonly");
    return requestResult<StoredInspection[]>(transaction.objectStore(STORAGE_STORES.inspections).getAll());
  });
}

export async function saveOutboxOperation(operation: OutboxOperation, connection?: IDBDatabase): Promise<void> {
  assertOutboxOperation(operation);
  await useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.outbox, "readwrite");
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORAGE_STORES.outbox).put(operation);
    await completed;
  });
}

export async function getOutboxOperation(
  operationId: string,
  connection?: IDBDatabase
): Promise<OutboxOperation | undefined> {
  if (!operationId.trim()) throw new TypeError("El identificador de operación es obligatorio.");
  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.outbox, "readonly");
    return requestResult<OutboxOperation | undefined>(transaction.objectStore(STORAGE_STORES.outbox).get(operationId));
  });
}

export async function getAllOutboxOperations(connection?: IDBDatabase): Promise<OutboxOperation[]> {
  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.outbox, "readonly");
    return requestResult<OutboxOperation[]>(transaction.objectStore(STORAGE_STORES.outbox).getAll());
  });
}

export async function updateOutboxOperation(
  operationId: string,
  changes: Partial<Omit<OutboxOperation, "operationId" | "entityId" | "type" | "payload" | "createdAt">>,
  connection?: IDBDatabase
): Promise<OutboxOperation> {
  if (!operationId.trim()) throw new TypeError("El identificador de operación es obligatorio.");

  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.outbox, "readwrite");
    const completed = transactionCompleted(transaction);
    const store = transaction.objectStore(STORAGE_STORES.outbox);
    const current = await requestResult<OutboxOperation | undefined>(store.get(operationId));

    if (!current) {
      transaction.abort();
      await completed.catch(() => undefined);
      throw new Error(`No existe la operación ${operationId}.`);
    }

    const updated = { ...current, ...changes, operationId: current.operationId };
    assertOutboxOperation(updated);
    store.put(updated);
    await completed;
    return updated;
  });
}

export async function saveInspectionWithOperation(
  inspection: StoredInspection,
  operation: OutboxOperation,
  connection?: IDBDatabase
): Promise<void> {
  assertStoredInspection(inspection);
  assertOutboxOperation(operation);

  if (inspection.id !== operation.entityId || inspection.sync.pendingOperationId !== operation.operationId) {
    throw new TypeError("La inspección y la operación pendiente no pertenecen a la misma mutación.");
  }

  await useDatabase(connection, async (database) => {
    const transaction = database.transaction(
      [STORAGE_STORES.inspections, STORAGE_STORES.outbox],
      "readwrite"
    );
    const completed = transactionCompleted(transaction);
    try {
      transaction.objectStore(STORAGE_STORES.inspections).put(inspection);
      transaction.objectStore(STORAGE_STORES.outbox).put(operation);
      await completed;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // La transacción ya pudo abortarse automáticamente por IndexedDB.
      }
      await completed.catch(() => undefined);
      throw error;
    }
  });
}

export async function saveSyncMeta(record: SyncMetaRecord, connection?: IDBDatabase): Promise<void> {
  if (!record.key.trim() || !record.updatedAt || Number.isNaN(Date.parse(record.updatedAt))) {
    throw new TypeError("Los metadatos de sincronización no son válidos.");
  }

  await useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.syncMeta, "readwrite");
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORAGE_STORES.syncMeta).put(record);
    await completed;
  });
}

export async function getSyncMeta(key: string, connection?: IDBDatabase): Promise<SyncMetaRecord | undefined> {
  if (!key.trim()) throw new TypeError("La clave de metadatos es obligatoria.");
  return useDatabase(connection, async (database) => {
    const transaction = database.transaction(STORAGE_STORES.syncMeta, "readonly");
    return requestResult<SyncMetaRecord | undefined>(transaction.objectStore(STORAGE_STORES.syncMeta).get(key));
  });
}
