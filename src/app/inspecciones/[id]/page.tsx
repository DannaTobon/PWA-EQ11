import Link from "next/link";
import { notFound } from "next/navigation";
import { inspections } from "@/lib/data/inspections";

export const dynamic = "force-dynamic";

type InspectionDetailPageProps = {
  params: {
    id: string;
  };
};

export default function InspectionDetailPage({ params }: InspectionDetailPageProps) {
  const inspection = inspections.find(({ id }) => id === params.id);

  if (!inspection) {
    notFound();
  }

  return (
    <article className="page-shell" aria-labelledby="inspection-title">
      <header className="hero">
        <p className="eyebrow">Detalle de inspección</p>
        <h1 id="inspection-title">{inspection.location}</h1>
        <span className={`badge badge-${inspection.status}`}>{inspection.statusLabel}</span>
      </header>

      <section className="content-section" aria-labelledby="summary-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2 id="summary-heading">Información de la inspección</h2>
          </div>
        </div>

        <div className="inspection-card">
          <p>{inspection.summary}</p>
          <dl>
            <div>
              <dt>Laboratorio</dt>
              <dd>{inspection.location}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>
                <time dateTime={inspection.date}>{inspection.date}</time>
              </dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{inspection.inspector}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{inspection.statusLabel}</dd>
            </div>
            <div>
              <dt>Hallazgos</dt>
              <dd>{inspection.findings}</dd>
            </div>
          </dl>
        </div>
      </section>

      <p className="footer">
        <Link href="/inspecciones">Volver al listado de inspecciones</Link>
      </p>
    </article>
  );
}
