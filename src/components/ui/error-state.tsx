"use client";

import { useEffect } from "react";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  useEffect(() => {
    // Aquí se podría loggear el error a un servicio externo
    console.error("Error capturado por ErrorState:", error);
  }, [error]);

  return (
    <div 
      className="state-container"
      role="alert"
    >
      <div className="error-card">
        <div style={{ marginBottom: "16px" }} aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "48px", height: "48px", margin: "0 auto" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2>Algo salió mal</h2>
        <p>
          Ha ocurrido un error inesperado al procesar la solicitud.
        </p>
        
        <button
          onClick={() => reset()}
          className="btn btn-danger"
          aria-label="Reintentar cargar la página"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
