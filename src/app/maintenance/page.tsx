import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mantenimiento"
};

export default function MaintenancePage() {
  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">Mantenimiento</p>
        <h1>Mantenimiento de laboratorios</h1>
        <p className="lead">
          Sección para registrar y consultar las tareas de mantenimiento de los laboratorios.
        </p>
      </header>

      <section aria-labelledby="maintenance-heading" className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Estructura inicial</p>
            <h2 id="maintenance-heading">Mantenimiento</h2>
          </div>
        </div>

        <div className="inspection-card">
          <p>
            Esta sección se encuentra en su estructura inicial. En próximas actualizaciones
            permitirá registrar y consultar las actividades de mantenimiento de los laboratorios.
          </p>
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
