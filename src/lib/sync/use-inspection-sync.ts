"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAllInspections, getAllOutboxOperations } from "@/lib/storage/indexeddb";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";
import { createHttpSender } from "@/lib/sync/client";
import {
  listConflicts,
  resolveConflict,
  type ConflictDecision,
  type ConflictRecord
} from "@/lib/sync/conflict-policy";
import { getPendingOperations, processQueue, retryFailedOperation } from "@/lib/sync/queue";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Ha ocurrido un error de sincronización.";
}

/** Conecta la cola persistente con el ciclo de vida de la pantalla de inspecciones. */
export function useInspectionSync() {
  const [inspections, setInspections] = useState<StoredInspection[]>([]);
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [syncingEntityIds, setSyncingEntityIds] = useState<Set<string>>(new Set());
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const processingRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    const [nextInspections, nextOperations, nextConflicts] = await Promise.all([
      getAllInspections(),
      getAllOutboxOperations(),
      listConflicts()
    ]);
    if (!mountedRef.current) return;
    setInspections(nextInspections);
    setOperations(nextOperations);
    setConflicts(nextConflicts);
  }, []);

  const synchronize = useCallback((): Promise<void> => {
    if (processingRef.current) return processingRef.current;

    const task = (async () => {
      if (mountedRef.current) {
        setIsSynchronizing(true);
        setSyncError(null);
      }
      try {
        const runnable = await getPendingOperations();
        if (mountedRef.current) {
          setSyncingEntityIds(new Set(runnable.map(({ entityId }) => entityId)));
        }
        await processQueue({ send: createHttpSender() });
      } catch (error) {
        if (mountedRef.current) setSyncError(messageFrom(error));
      } finally {
        try {
          await refresh();
        } catch (error) {
          if (mountedRef.current) setSyncError(messageFrom(error));
        }
        if (mountedRef.current) {
          setSyncingEntityIds(new Set());
          setIsSynchronizing(false);
        }
      }
    })();

    processingRef.current = task;
    void task.finally(() => {
      if (processingRef.current === task) processingRef.current = null;
    });
    return task;
  }, [refresh]);

  const retry = useCallback(async (operationId: string) => {
    try {
      setSyncError(null);
      await retryFailedOperation(operationId);
      await synchronize();
    } catch (error) {
      if (mountedRef.current) setSyncError(messageFrom(error));
    }
  }, [synchronize]);

  const resolve = useCallback(async (entityId: string, decision: ConflictDecision) => {
    try {
      setSyncError(null);
      await resolveConflict(entityId, decision);
      await synchronize();
    } catch (error) {
      if (mountedRef.current) setSyncError(messageFrom(error));
    }
  }, [synchronize]);

  useEffect(() => {
    mountedRef.current = true;
    const handleOnline = () => void synchronize();
    window.addEventListener("online", handleOnline);
    void synchronize();

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [synchronize]);

  return {
    inspections,
    operations,
    conflicts,
    syncingEntityIds,
    isSynchronizing,
    syncError,
    refresh,
    synchronize,
    retry,
    resolve
  };
}
