import { deleteCapabilitiesDatabase } from "@/lib/device/capabilities-storage";
import { deleteStorageDatabase } from "@/lib/storage/indexeddb";

export interface LocalDataPurgeReport {
  inspectionsStorage: boolean;
  capabilitiesStorage: boolean;
  cachesCleared: boolean;
  webStorageCleared: boolean;
  purgedAt: string;
}

/**
 * Operación centralizada y verificable para eliminar todos los datos locales
 * administrados por la aplicación (IndexedDB principal, IndexedDB de capacidades,
 * cachés del Service Worker y almacenamiento web local).
 */
export async function clearLocalApplicationData(): Promise<LocalDataPurgeReport> {
  let inspectionsStorage = false;
  let capabilitiesStorage = false;
  let cachesCleared = false;
  let webStorageCleared = false;

  // 1. Eliminar base de datos principal de IndexedDB (inspecciones, outbox y syncMeta)
  try {
    await deleteStorageDatabase();
    inspectionsStorage = true;
  } catch {
    inspectionsStorage = false;
  }

  // 2. Eliminar base de datos auxiliar de IndexedDB (fotos y coordenadas)
  try {
    await deleteCapabilitiesDatabase();
    capabilitiesStorage = true;
  } catch {
    capabilitiesStorage = false;
  }

  // 3. Limpiar cachés del Service Worker (CacheStorage)
  try {
    if (typeof caches !== "undefined" && typeof caches.keys === "function") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      cachesCleared = true;
    } else {
      cachesCleared = true;
    }
  } catch {
    cachesCleared = false;
  }

  // 4. Limpiar Web Storage (localStorage y sessionStorage)
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.clear === "function") {
      localStorage.clear();
    }
    if (typeof sessionStorage !== "undefined" && typeof sessionStorage.clear === "function") {
      sessionStorage.clear();
    }
    webStorageCleared = true;
  } catch {
    webStorageCleared = false;
  }

  return {
    inspectionsStorage,
    capabilitiesStorage,
    cachesCleared,
    webStorageCleared,
    purgedAt: new Date().toISOString()
  };
}
