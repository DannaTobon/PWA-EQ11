import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("renderiza los 4 landmarks de accesibilidad (banner, nav, main, contentinfo)", () => {
    render(
      <AppShell>
        <p>Contenido de la página</p>
      </AppShell>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("muestra el contenido recibido (children) dentro del landmark main", () => {
    render(
      <AppShell>
        <p>Contenido de la página</p>
      </AppShell>
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Contenido de la página");
  });

  it("incluye los links de navegación a Inspecciones y Mantenimiento con su href correcto", () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>
    );

    const inspectionsLink = screen.getByRole("link", { name: "Inspecciones" });
    const maintenanceLink = screen.getByRole("link", { name: "Mantenimiento" });

    expect(inspectionsLink).toHaveAttribute("href", "/inspections");
    expect(maintenanceLink).toHaveAttribute("href", "/maintenance");
  });

  it("el link de marca regresa al inicio", () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Inspecciones UTT" })).toHaveAttribute("href", "/");
  });
});
