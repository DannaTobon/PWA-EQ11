import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

describe("LoadingState", () => {
  it("expone un indicador de carga accesible (role=status) con etiqueta", () => {
    render(<LoadingState />);

    expect(screen.getByRole("status", { name: "Cargando contenido" })).toBeInTheDocument();
  });

  it("anuncia el estado como ocupado con aria-live y aria-busy", () => {
    const { container } = render(<LoadingState />);
    const wrapper = container.querySelector(".state-container");

    expect(wrapper).toHaveAttribute("aria-live", "polite");
    expect(wrapper).toHaveAttribute("aria-busy", "true");
  });

  it("muestra un mensaje visible de carga", () => {
    render(<LoadingState />);
    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("se anuncia como una alerta (role=alert)", () => {
    render(<ErrorState error={new Error("fallo de prueba")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("muestra un mensaje de error entendible para la persona usuaria", () => {
    render(<ErrorState error={new Error("fallo de prueba")} reset={vi.fn()} />);
    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
  });

  it("invoca reset() al hacer clic en 'Reintentar'", () => {
    const resetMock = vi.fn();
    render(<ErrorState error={new Error("fallo de prueba")} reset={resetMock} />);

    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState", () => {
  it("renderiza el título y la descripción recibidos por props", () => {
    render(<EmptyState title="Sin inspecciones" description="Aún no hay registros para mostrar." />);

    expect(screen.getByText("Sin inspecciones")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay registros para mostrar.")).toBeInTheDocument();
  });

  it("renderiza la acción opcional cuando se proporciona", () => {
    render(
      <EmptyState
        title="Sin inspecciones"
        description="Aún no hay registros para mostrar."
        action={<button>Registrar inspección</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Registrar inspección" })).toBeInTheDocument();
  });

  it("no rompe si no se proporciona icon ni action", () => {
    render(<EmptyState title="Sin datos" description="No hay nada aquí todavía." />);

    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
