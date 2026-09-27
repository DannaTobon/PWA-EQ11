import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InspeccionesPage from "@/app/inspecciones/page";
import InspectionDetailPage from "@/app/inspecciones/[id]/page";

// notFound() de Next.js normalmente interrumpe el render lanzando una señal
// interna que el framework intercepta para mostrar not-found.tsx. En un test
// unitario con Vitest no existe ese runtime, así que se sustituye por un
// mock que lanza un error explícito: esto permite comprobar que la ruta SSR
// invoca notFound() ante un id inexistente, sin depender del comportamiento
// interno de Next.js (ver límite documentado en docs/rendering-decision.md).
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

import { notFound } from "next/navigation";

const inspeccionSintetica = {
  id: "inspection-001",
  location: "Laboratorio de Redes",
  date: "2026-08-28",
  inspector: "Técnica A",
  status: "ok",
  statusLabel: "Sin incidencias",
  findings: 0,
  summary: "Revisión visual de cableado, ventilación y estaciones de trabajo."
};

function mockFetchExitoso() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([inspeccionSintetica])
  });
}

function mockFetchFallido() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: "Error sintético" })
  });
}

describe("Listado CSR de inspecciones (/inspecciones)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("muestra el estado de carga y después la lista tras una respuesta exitosa", async () => {
    vi.stubGlobal("fetch", mockFetchExitoso());

    render(<InspeccionesPage />);

    expect(screen.getByRole("status", { name: "Cargando contenido" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Laboratorio de Redes")).toBeInTheDocument();
    });
  });

  it("muestra el estado de error ante el fallo controlado (respuesta no ok)", async () => {
    vi.stubGlobal("fetch", mockFetchFallido());

    render(<InspeccionesPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("el reintento ('Actualizar datos') recupera la lista después de un error previo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "Error sintético" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([inspeccionSintetica]) });
    vi.stubGlobal("fetch", fetchMock);

    render(<InspeccionesPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar cargar la página" }));

    await waitFor(() => {
      expect(screen.getByText("Laboratorio de Redes")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Detalle SSR de inspección (/inspecciones/[id])", () => {
  it("renderiza los datos de una inspección con id válido", () => {
    render(<InspectionDetailPage params={{ id: "inspection-001" }} />);

    expect(screen.getByRole("heading", { level: 1, name: "Laboratorio de Redes" })).toBeInTheDocument();
    expect(screen.getByText("Técnica A")).toBeInTheDocument();
  });

  it("invoca notFound() cuando el id no existe", () => {
    expect(() => render(<InspectionDetailPage params={{ id: "no-existe" }} />)).toThrow();
    expect(notFound).toHaveBeenCalled();
  });
});
