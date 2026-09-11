import type { Metadata } from "next";
import Link from "next/link";
import { inspections } from "@/lib/data/inspections";

export const metadata: Metadata = {
  title: "Inspecciones"
};

export default function InspectionsPage() {
  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">Inspecciones</p>
        <h1>Inspecciones de laboratorio</h1>
        <p className="lead">
          Listado de inspecciones realizadas en los laboratorios. Los datos mostrados son sintéticos.
        </p>
      </header>

      <section aria-labelledby="inspections-heading" className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Datos de demostración</p>
            <h2 id="inspections-heading">Inspecciones recientes</h2>
          </div>
          <span className="count">{inspections.length} registros</span>
        </div>

        <div className="inspection-grid">
          {inspections.map((inspection) => (
            <article className="inspection-card" key={inspection.id}>
              <div className="card-topline">
                <span className={`badge badge-${inspection.status}`}>{inspection.statusLabel}</span>
                <span className="muted">{inspection.date}</span>
              </div>
              <h3>{inspection.location}</h3>
              <p>{inspection.summary}</p>
              <dl>
                <div>
                  <dt>Responsable</dt>
                  <dd>{inspection.inspector}</dd>
                </div>
                <div>
                  <dt>Hallazgos</dt>
                  <dd>{inspection.findings}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>
          <Link href="/">Inicio</Link>
        </p>
        <p>Aplicaciones Web Progresivas · Universidad Tecnológica de Tehuacán</p>
      </footer>
    </main>
  );
}
