"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inspection } from "@/lib/data/inspections";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function InspeccionesPage() {
  const [data, setData] = useState<Inspection[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(new Error(err.message || "Ha ocurrido un error inesperado."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  if (isLoading) {
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <ErrorState error={error} reset={fetchInspections} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Visualización CSR</p>
          <h2>Listado de Inspecciones</h2>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/inspecciones?fallar=1" className="btn btn-danger">
            Forzar Error
          </Link>
          <button onClick={fetchInspections} className="btn btn-primary" aria-label="Actualizar datos">
            Refrescar
          </button>
        </div>
      </div>

      <div className="inspection-grid">
        {data?.map((inspection) => (
          <div key={inspection.id} className="inspection-card">
            <div className="card-topline">
              <span className="eyebrow">{inspection.id}</span>
              <span className={`badge ${inspection.status === "ok" ? "badge-ok" : "badge-attention"}`}>
                {inspection.statusLabel}
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
              <Link 
                href={`/inspecciones/${inspection.id}`}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Ver Detalle SSR
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
