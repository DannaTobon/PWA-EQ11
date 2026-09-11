import { ReactNode } from "react";

export function LoadingState() {
  return (
    <div 
      className="state-container"
      aria-live="polite"
      aria-busy="true"
    >
      <div 
        className="loading-spinner" 
        role="status"
        aria-label="Cargando contenido"
      />
      <h2>Cargando...</h2>
      <p className="muted">Por favor, espera un momento.</p>
    </div>
  );
}
