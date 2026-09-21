import { describe, expect, it } from "vitest";
import { loadServiceWorker, swRequest, type FetchLike } from "./harness/service-worker";

const PAGES = "pwa-eq11-v1-pages";
const STATIC = "pwa-eq11-v1-static";
const CORE = "pwa-eq11-v1-core";

const offlineFetch = (): FetchLike =>
  async () => {
    throw new TypeError("Failed to fetch (offline simulado)");
  };

const onlineFetch = (
  status = 200,
  contentType = "text/html; charset=UTF-8",
  body = "<html>ok</html>"
): FetchLike =>
  async () => new Response(body, { status, headers: { "Content-Type": contentType } });

const readText = async (response: Response | undefined) =>
  response ? await response.text() : "";

describe("offline.spec", () => {
  it("navegación online 200 → responde red y cachea en pages", async () => {
    const harness = loadServiceWorker({
      fetchImpl: onlineFetch(200, "text/html; charset=UTF-8", "<html>online</html>")
    });
    const { intercepted, response } = await harness.handleFetch(
      swRequest("/inspections", { mode: "navigate" })
    );
    expect(intercepted).toBe(true);
    expect(response?.status).toBe(200);
    expect(await readText(response)).toContain("online");
    await harness.flush();
    expect(harness.cache(PAGES).has("/inspections")).toBe(true);
  });

  it("navegación offline con copia en pages → sirve pages", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    harness.cache(PAGES).seed("/inspections", "<html>copia-pages</html>");
    const { intercepted, response } = await harness.handleFetch(
      swRequest("/inspections", { mode: "navigate" })
    );
    expect(intercepted).toBe(true);
    expect(response?.status).toBe(200);
    expect(await readText(response)).toContain("copia-pages");
  });

  it("navegación offline sin pages pero con ruta precacheada → sirve core", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    harness.cache(CORE).seed("/inspections", "<html>core-precache</html>");
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { mode: "navigate" })
    );
    expect(response?.status).toBe(200);
    expect(await readText(response)).toContain("core-precache");
  });

  it("navegación offline sin ruta en caché → sirve /offline.html de core", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    harness.cache(CORE).seed("/offline.html", "<html>Sin conexión</html>");
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { mode: "navigate" })
    );
    expect(response?.status).toBe(200);
    expect(await readText(response)).toContain("Sin conexión");
  });

  it("navegación offline sin fallback en core → 503 text/html", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { mode: "navigate" })
    );
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Content-Type")).toMatch(/^text\/html/);
  });

  it("RSC offline nunca recibe HTML (ni la copia cacheada de la misma URL)", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    harness.cache(PAGES).seed("/inspections", "<html>HTML QUE ROMPERÍA EL CLIENTE</html>");
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { headers: { RSC: "1" } })
    );
    expect(response?.status).toBe(503);
    const contentType = response?.headers.get("Content-Type") ?? "";
    expect(contentType).not.toMatch(/^text\/html/);
    expect(contentType).toMatch(/^text\/plain/);
    expect(await readText(response)).not.toContain("HTML QUE ROMPERÍA EL CLIENTE");
  });

  it("RSC offline sin red → 503 text/plain (nunca inventa un 200)", async () => {
    const harness = loadServiceWorker({ fetchImpl: offlineFetch() });
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { headers: { RSC: "1" } })
    );
    expect(response?.status).toBe(503);
    expect(response?.ok).toBe(false);
    expect(response?.headers.get("Content-Type")).toMatch(/^text\/plain/);
  });

  it("RSC online con payload Flight → 200 text/x-component y NO se persiste", async () => {
    const harness = loadServiceWorker({
      fetchImpl: onlineFetch(200, "text/x-component", "flight-payload")
    });
    const { response } = await harness.handleFetch(
      swRequest("/inspections", { headers: { RSC: "1" } })
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toContain("text/x-component");
    await harness.flush();
    for (const cacheName of [PAGES, STATIC, CORE]) {
      expect(harness.cache(cacheName).has("/inspections")).toBe(false);
    }
  });

  it("assets /_next/static/** → Cache First (red no consultada si hay caché)", async () => {
    const harness = loadServiceWorker({ fetchImpl: onlineFetch() });
    harness.cache(STATIC).seed("/_next/static/chunks/main.js", "console.log(1)", {
      contentType: "application/javascript; charset=utf-8"
    });
    const { intercepted, response } = await harness.handleFetch(
      swRequest("/_next/static/chunks/main.js")
    );
    expect(intercepted).toBe(true);
    expect(response?.status).toBe(200);
    expect(await readText(response)).toContain("console.log(1)");
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("manifest e iconos se sirven desde core (precache) sin tocar red", async () => {
    const paths = ["/manifest.webmanifest", "/icon-192x192.png", "/icon-512x512.png"];
    const harness = loadServiceWorker({ fetchImpl: onlineFetch() });
    for (const p of paths) {
      harness.cache(CORE).seed(p, "data", { contentType: "application/octet-stream" });
    }
    for (const p of paths) {
      const { response } = await harness.handleFetch(swRequest(p));
      expect(response?.status).toBe(200);
    }
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("static miss + red 200 → se guarda en el cache static", async () => {
    const harness = loadServiceWorker({
      fetchImpl: onlineFetch(200, "application/javascript; charset=utf-8", "chunk-fresh")
    });
    const { response } = await harness.handleFetch(swRequest("/_next/static/chunks/nuevo.js"));
    expect(response?.status).toBe(200);
    await harness.flush();
    expect(harness.cache(STATIC).has("/_next/static/chunks/nuevo.js")).toBe(true);
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("nunca cachea respuestas !ok", async () => {
    const harness = loadServiceWorker({
      fetchImpl: onlineFetch(500, "text/html", "<html>error</html>")
    });
    const nav = await harness.handleFetch(swRequest("/inspections", { mode: "navigate" }));
    expect(nav.response?.status).toBe(500);
    await harness.handleFetch(swRequest("/_next/static/x.js"));
    await harness.flush();
    expect(harness.cache(PAGES).has("/inspections")).toBe(false);
    expect(harness.cache(STATIC).has("/_next/static/x.js")).toBe(false);
  });

  it("métodos no GET no se interceptan", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const harness = loadServiceWorker();
      const { intercepted } = await harness.handleFetch(swRequest("/inspections", { method }));
      expect(intercepted).toBe(false);
    }
  });

  it("requests con Authorization no se interceptan", async () => {
    const harness = loadServiceWorker();
    const { intercepted } = await harness.handleFetch(
      swRequest("/api/privado", { headers: { Authorization: "Bearer token" } })
    );
    expect(intercepted).toBe(false);
  });

  it("requests cross-origin no se interceptan", async () => {
    const harness = loadServiceWorker();
    const { intercepted } = await harness.handleFetch(swRequest("https://cdn-otro.test/x.js"));
    expect(intercepted).toBe(false);
  });

  it("/sw.js no se intercepta", async () => {
    const harness = loadServiceWorker();
    const { intercepted } = await harness.handleFetch(swRequest("/sw.js"));
    expect(intercepted).toBe(false);
  });

  it("recursos no clasificados pasan directo (passthrough sin respondWith)", async () => {
    const harness = loadServiceWorker({ fetchImpl: onlineFetch() });
    const { intercepted } = await harness.handleFetch(swRequest("/favicon.ico"));
    expect(intercepted).toBe(false);
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });
});