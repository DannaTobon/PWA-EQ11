import type { ConflictDecision, ConflictRecord } from "@/lib/sync/conflict-policy";

type Props = {
  conflict: ConflictRecord;
  disabled?: boolean;
  onResolve: (entityId: string, decision: ConflictDecision) => void;
};

export function InspectionConflictReview({ conflict, disabled = false, onResolve }: Props) {
  return (
    <article className="inspection-card" aria-labelledby={`conflict-${conflict.entityId}`}>
      <div className="card-topline">
        <h3 id={`conflict-${conflict.entityId}`}>Revisión requerida: {conflict.entityId}</h3>
        <span className="badge badge-attention">Conflicto</span>
      </div>
      <p>
        La revisión local {conflict.baseRevision ?? "inicial"} no coincide con la revisión remota {conflict.remoteRevision}.
        Las operaciones posteriores de esta inspección permanecen bloqueadas.
      </p>
      <div className="inspection-grid">
        <section aria-label="Versión local">
          <h4>Versión local</h4>
          <strong>{conflict.local.location}</strong>
          <p>{conflict.local.summary}</p>
          <small>Hallazgos: {conflict.local.findings}</small>
        </section>
        <section aria-label="Versión remota">
          <h4>Versión remota</h4>
          <strong>{conflict.remote.location}</strong>
          <p>{conflict.remote.summary}</p>
          <small>Hallazgos: {conflict.remote.findings}</small>
        </section>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px" }}>
        <button className="btn btn-primary" disabled={disabled} onClick={() => onResolve(conflict.entityId, "keepLocal")}>
          Conservar versión local
        </button>
        <button className="btn btn-danger" disabled={disabled} onClick={() => onResolve(conflict.entityId, "acceptServer")}>
          Aceptar versión del servidor
        </button>
      </div>
    </article>
  );
}
