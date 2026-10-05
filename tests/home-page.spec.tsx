import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("Página de inicio", () => {
  it("dirige la tarjeta de Inspecciones a la ruta canónica", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Inspecciones" })).toHaveAttribute(
      "href",
      "/inspecciones"
    );
  });
});
