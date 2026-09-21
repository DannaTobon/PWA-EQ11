import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadServiceWorker, type FetchLike } from "./harness/service-worker";

const SW_PATH = resolve(process.cwd(), "public/sw.js");

const CORE = "pwa-eq11-v1-core";
const PAGES = "pwa-eq11-v1-pages";
const STATIC = "pwa-eq11-v1-static";

const okFetch = (): FetchLike =>
  async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(`<html data-url="${url}"></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  };

describe("service-worker.spec", () => {
  it("public/sw.js existe y es JavaScript válido", () => {
    expect(existsSync(SW_PATH)).toBe(true);
    const source = loadServiceWorker().source;
    expect(() => new Function(source)).not.toThrow();
  });

  it("precachea exactamente la lista documentada de 7 recursos", async () => {
    const harness = loadServiceWorker({ fetchImpl: okFetch() });
    await harness.triggerInstall();
    const urls = new Set(harness.cache(CORE).keys());
    expect(urls).toEqual(
      new Set([
        "http://localhost/",
        "http://localhost/inspections",
        "http://localhost/maintenance",
        "http://localhost/manifest.webmanifest",
        "http://localhost/icon-192x192.png",
        "http://localhost/icon-512x512.png",
        "http://localhost/offline.html"
      ])
    );
  });

  it("no precachea /test-error ni /_not-found", async () => {
    const harness = loadServiceWorker({ fetchImpl: okFetch() });
    await harness.triggerInstall();
    const urls = harness.cache(CORE).keys().join("\n");
    expect(urls).not.toContain("/test-error");
    expect(urls).not.toContain("/_not-found");
  });

  it("install crea únicamente pwa-eq11-v1-core", async () => {
    const harness = loadServiceWorker({ fetchImpl: okFetch() });
    await harness.triggerInstall();
    await expect(harness.caches.keys()).resolves.toEqual([CORE]);
  });

  it("activate elimina cachés de versiones anteriores", async () => {
    const harness = loadServiceWorker({ fetchImpl: okFetch() });
    harness.cache("pwa-eq11-v0-pages");
    harness.cache("pwa-eq11-v0-core");
    harness.cache("cache-sin-versionar");
    await harness.triggerActivate();
    const restantes = await harness.caches.keys();
    expect(restantes).not.toContain("pwa-eq11-v0-pages");
    expect(restantes).not.toContain("pwa-eq11-v0-core");
    expect(restantes).not.toContain("cache-sin-versionar");
  });

  it("activate conserva pages/static/core de la versión actual", async () => {
    const harness = loadServiceWorker({ fetchImpl: okFetch() });
    harness.cache(PAGES);
    harness.cache(STATIC);
    harness.cache(CORE);
    await harness.triggerActivate();
    const restantes = (await harness.caches.keys()).sort();
    expect(restantes).toEqual([CORE, PAGES, STATIC].sort());
  });

  it("no usa skipWaiting()", () => {
    expect(loadServiceWorker().source).not.toContain("skipWaiting");
  });

  it("no usa clients.claim()", () => {
    expect(loadServiceWorker().source).not.toContain("clients.claim");
  });
});