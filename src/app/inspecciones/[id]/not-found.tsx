import Link from "next/link";

export default function InspectionNotFound() {
  return (
    <section className="page-shell state-container" aria-labelledby="not-found-title">
      <div className="empty-card">
        <p className="eyebrow">Inspección no encontrada</p>
        <h1 id="not-found-title">No existe esta inspección</h1>
        <p>Verifica el identificador o vuelve al listado de inspecciones disponibles.</p>
        <Link className="btn btn-primary" href="/inspecciones">
          Volver al listado de inspecciones
        </Link>
      </div>
    </section>
  );
}
