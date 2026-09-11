import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">Inspecciones y mantenimiento</p>
        <h1>Inspecciones de laboratorio</h1>
        <p className="lead">
          Registro y consulta de inspecciones y mantenimiento de los laboratorios,
          preparado para trabajar con conectividad intermitente.
        </p>
        <span className="status">Datos sintéticos de demostración</span>
      </header>

      <nav aria-label="Secciones principales" className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Secciones</p>
            <h2 id="sections-heading">Explora la aplicación</h2>
          </div>
        </div>

        <div className="inspection-grid">
          <div className="inspection-card">
            <h3>
              <Link href="/inspections">Inspecciones</Link>
            </h3>
            <p>Consulta las inspecciones de los laboratorios registradas recientemente.</p>
          </div>
          <div className="inspection-card">
            <h3>
              <Link href="/maintenance">Mantenimiento</Link>
            </h3>
            <p>Revisa y gestiona las tareas de mantenimiento de los laboratorios.</p>
          </div>
        </div>
      </nav>

      <footer className="footer">
        <p>Aplicaciones Web Progresivas · Universidad Tecnológica de Tehuacán</p>
      </footer>
    </main>
  );
}
