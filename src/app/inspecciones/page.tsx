"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Inspection, InspectionStatus } from "@/lib/data/inspections";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { InspectionConflictReview } from "@/components/inspection-conflict-review";
import { saveInspectionWithOperation } from "@/lib/storage/indexeddb";
import type { OutboxOperation, StoredInspection } from "@/lib/storage/schema";
import { useInspectionSync } from "@/lib/sync/use-inspection-sync";

type CaptureForm = {
  location: string;
  date: string;
  inspector: string;
  status: InspectionStatus;
  findings: string;
  summary: string;
};

const INITIAL_FORM: CaptureForm = {
  location: "Laboratorio Sintético",
  date: "2026-09-29",
  inspector: "Técnica Sintética",
  status: "ok",
  findings: "0",
  summary: "Inspección sintética capturada sin conexión."
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
}

function newIdentifier(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("El navegador no permite generar identificadores locales seguros.");
  }
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function isStoredInspection(inspection: Inspection | StoredInspection): inspection is StoredInspection {
  return "sync" in inspection;
}

export default function InspeccionesPage() {
  const [remoteInspections, setRemoteInspections] = useState<Inspection[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<CaptureForm>(INITIAL_FORM);
  const {
    inspections: localInspections,
    operations,
    conflicts,
    syncingEntityIds,
    isSynchronizing,
    syncError,
    refresh,
    synchronize,
    retry,
    resolve
  } = useInspectionSync();

  const fetchInspections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fallar = urlParams.get("fallar");
      const url = fallar === "1" ? "/api/inspecciones?fallar=1" : "/api/inspecciones";

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("No se pudo obtener la lista de inspecciones.");
      }
      const result = (await response.json()) as Inspection[];
      setRemoteInspections(result);
    } catch (caughtError) {
      setError(new Error(errorMessage(caughtError)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchInspections();
  }, []);

  const visibleInspections = useMemo<Array<Inspection | StoredInspection>>(() => {
    const byId = new Map<string, Inspection | StoredInspection>();
    remoteInspections.forEach((inspection) => byId.set(inspection.id, inspection));
    localInspections.forEach((inspection) => byId.set(inspection.id, inspection));
    return Array.from(byId.values());
  }, [localInspections, remoteInspections]);

  const captureInspection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setCaptureMessage(null);
    setStorageError(null);

    try {
      const now = new Date().toISOString();
      const entityId = newIdentifier("local-inspection");
      const operationId = newIdentifier("operation");
      const findings = Number(form.findings);
      const statusLabel = form.status === "ok" ? "Sin incidencias" : "Requiere atención";

      const payload: Inspection = {
        id: entityId,
        location: form.location.trim(),
        date: form.date,
        inspector: form.inspector.trim(),
        status: form.status,
        statusLabel,
        findings,
        summary: form.summary.trim()
      };

      const localInspection: StoredInspection = {
        ...payload,
        sync: {
          status: "pending",
          baseRevision: null,
          pendingOperationId: operationId
        }
      };

      const operation: OutboxOperation = {
        operationId,
        entityId,
        type: "create",
        payload,
        baseRevision: null,
        attempts: 0,
        status: "pending",
        createdAt: now,
        updatedAt: now
      };

      await saveInspectionWithOperation(localInspection, operation);
      await refresh();
      setCaptureMessage("Inspección guardada localmente. Queda pendiente de sincronización.");
      setForm(INITIAL_FORM);
    } catch (caughtError) {
      setStorageError(`No se pudo guardar la inspección local: ${errorMessage(caughtError)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="content-section" aria-labelledby="offline-capture-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Captura offline</p>
            <h2 id="offline-capture-heading">Registrar inspección sintética</h2>
          </div>
        </div>

        <form className="inspection-card" onSubmit={captureInspection}>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            <label>
              Laboratorio
              <input
                required
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </label>
            <label>
              Fecha
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <label>
              Responsable sintético
              <input
                required
                value={form.inspector}
                onChange={(event) => setForm({ ...form, inspector: event.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as InspectionStatus })}
              >
                <option value="ok">Sin incidencias</option>
                <option value="attention">Requiere atención</option>
              </select>
            </label>
            <label>
              Hallazgos
              <input
                required
                min="0"
                step="1"
                type="number"
                value={form.findings}
                onChange={(event) => setForm({ ...form, findings: event.target.value })}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: "6px", marginTop: "12px" }}>
            Resumen sintético
            <textarea
              required
              rows={3}
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </label>
          <button className="btn btn-primary" disabled={isSaving} style={{ marginTop: "16px" }} type="submit">
            {isSaving ? "Guardando localmente…" : "Guardar sin conexión"}
          </button>
        </form>

        {captureMessage ? <p role="status">{captureMessage}</p> : null}
        {storageError ? <p className="muted">{storageError}</p> : null}
      </section>

      {conflicts.length > 0 ? (
        <section className="content-section" aria-labelledby="conflicts-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Revisión manual</p>
              <h2 id="conflicts-heading">Conflictos de sincronización</h2>
            </div>
          </div>
          <div style={{ display: "grid", gap: "16px" }}>
            {conflicts.map((conflict) => (
              <InspectionConflictReview
                key={conflict.entityId}
                conflict={conflict}
                disabled={isSynchronizing}
                onResolve={(entityId, decision) => void resolve(entityId, decision)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="content-section" aria-labelledby="inspections-list-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Visualización CSR</p>
            <h2 id="inspections-list-heading">Listado de Inspecciones</h2>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => void synchronize()}
              className="btn btn-primary"
              disabled={isSynchronizing}
              aria-label="Sincronizar operaciones pendientes"
            >
              {isSynchronizing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
            <Link href="/inspecciones?fallar=1" className="btn btn-danger">
              Forzar Error
            </Link>
            <button onClick={fetchInspections} className="btn btn-primary" aria-label="Actualizar datos">
              Refrescar
            </button>
          </div>
        </div>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState error={error} reset={fetchInspections} /> : null}
        {syncError ? <p role="alert">No se pudo completar la sincronización: {syncError}</p> : null}

        <div className="inspection-grid">
          {visibleInspections.map((inspection) => {
            const stored = isStoredInspection(inspection);
            const operation = stored
              ? operations.find(({ operationId }) => operationId === inspection.sync.pendingOperationId)
              : undefined;
            const status = operation?.status ?? (stored ? inspection.sync.status : "done");
            const syncing = stored && syncingEntityIds.has(inspection.id) && status === "pending";
            const statusLabel = syncing
              ? "Sincronizando"
              : status === "pending"
                ? "Pendiente"
                : status === "inFlight"
                  ? "Sincronizando"
                  : status === "failed"
                    ? "Fallida"
                    : status === "conflict"
                      ? "Conflicto: requiere revisión"
                      : "Sincronizada";
            const synchronized = status === "done";
            return (
              <div key={inspection.id} className="inspection-card">
                <div className="card-topline">
                  <span className="eyebrow">{inspection.id}</span>
                  <span className={`badge ${synchronized ? "badge-ok" : "badge-attention"}`}>
                    {statusLabel}
                  </span>
                </div>
                <h3 style={{ margin: "12px 0 8px" }}>{inspection.location}</h3>
                <p>{inspection.summary}</p>
                <dl>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{inspection.date}</dd>
                  </div>
                  <div>
                    <dt>Inspector</dt>
                    <dd>{inspection.inspector}</dd>
                  </div>
                </dl>
                <div style={{ marginTop: "20px", textAlign: "center" }}>
                  {status === "failed" && operation ? (
                    <button className="btn btn-primary" disabled={isSynchronizing} onClick={() => void retry(operation.operationId)}>
                      Reintentar sincronización
                    </button>
                  ) : !synchronized ? (
                    <span className="muted">
                      {status === "conflict" ? "Resuelve el conflicto para continuar." : "El detalle estará disponible después de sincronizar."}
                    </span>
                  ) : (
                    <Link
                      href={`/inspecciones/${inspection.id}`}
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                    >
                      Ver Detalle SSR
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
