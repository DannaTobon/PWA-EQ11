import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(import.meta.dirname, "..", "public", "manifest.webmanifest");

describe("manifest.webmanifest", () => {
  it("existe en public/manifest.webmanifest", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("es JSON válido", () => {
    const raw = readFileSync(manifestPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

  it("define name y short_name no vacíos", () => {
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(typeof manifest.short_name).toBe("string");
    expect(manifest.short_name.length).toBeGreaterThan(0);
  });

  it("define display como standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("define start_url y scope como rutas válidas", () => {
    expect(typeof manifest.start_url).toBe("string");
    expect(manifest.start_url.startsWith("/")).toBe(true);
    expect(typeof manifest.scope).toBe("string");
    expect(manifest.scope.startsWith("/")).toBe(true);
  });

  it("incluye los iconos requeridos de 192x192 y 512x512", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(typeof icon.src).toBe("string");
      expect(icon.src.startsWith("/")).toBe(true);
      expect(existsSync(resolve(import.meta.dirname, "..", "public", icon.src.replace(/^\//, "")))).toBe(true);
    }
  });
});
