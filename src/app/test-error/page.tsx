"use client";

import { useState } from "react";

export default function TestErrorPage() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error("¡Error forzado para pruebas de QA de Tonanzi!");
  }

  return (
    <div className="page-shell">
      <div className="qa-box">
        <span className="qa-badge">Módulo de Testing · Semana 2</span>
        <h2>Simulación de Error Determinista</h2>
        <p className="muted" style={{ margin: "14px 0 24px" }}>
          Esta ruta permite comprobar que el <code>ErrorBoundary</code> de Next.js
          atrapa los fallos y muestra la interfaz de <code>ErrorState</code> con el botón de reintentar.
        </p>
        <button
          onClick={() => setShouldError(true)}
          className="btn btn-danger"
          aria-label="Lanzar error de prueba"
        >
          Lanzar Error Determinista
        </button>
      </div>
    </div>
  );
}
