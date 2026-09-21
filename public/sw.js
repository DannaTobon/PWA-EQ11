"use strict";

const CACHE_VERSION = "pwa-eq11-v1";

const CACHE_NAMES = {
  pages: `${CACHE_VERSION}-pages`,
  static: `${CACHE_VERSION}-static`,
  core: `${CACHE_VERSION}-core`
};

const VERSION_PREFIX = `${CACHE_VERSION}-`;

const EXPECTED_CACHES = new Set(Object.values(CACHE_NAMES));

const PRECACHE_URLS = [
  "/",
  "/inspections",
  "/maintenance",
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/offline.html"
];

const STATIC_PRECACHED_PATHS = new Set([
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png"
]);

const STATIC_RUNTIME_PREFIX = "/_next/static/";

function isCurrentVersionCache(cacheName) {
  return cacheName.startsWith(VERSION_PREFIX) && EXPECTED_CACHES.has(cacheName);
}

function syntheticResponse(status, contentType, body) {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType }
  });
}

// RSC: Next.js marca el Flight payload (soft navigation y prefetch) con el
// header "RSC: 1". Se detecta por header y no por request.mode: esas peticiones
// llegan como fetch (mode "cors"), no como navegaciones de documento.
function isRSCRequest(request) {
  return request.headers.get("RSC") === "1";
}

function isStaticAsset(url) {
  return url.pathname.startsWith(STATIC_RUNTIME_PREFIX) || STATIC_PRECACHED_PATHS.has(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.core).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => !isCurrentVersionCache(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
});

async function handleNavigation(request) {
  const pagesCache = await caches.open(CACHE_NAMES.pages);
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const fromPages = await pagesCache.match(request.url);
    if (fromPages) return fromPages;
    const coreCache = await caches.open(CACHE_NAMES.core);
    const fromCore = await coreCache.match(request.url);
    if (fromCore) return fromCore;
    const offlineHtml = await coreCache.match("/offline.html");
    if (offlineHtml) return offlineHtml;
    return syntheticResponse(503, "text/html; charset=UTF-8", "");
  }
  if (response.ok) {
    const clone = response.clone();
    pagesCache.put(request.url, clone).catch(() => {});
  }
  return response;
}

// RSC: passthrough Network First. La opcion conservadora de este bloque es NO
// persistir Flight payloads, para no mezclar HTML y RSC de la misma URL en
// Cache Storage ni asumir compatibilidad con el header Vary de esas respuestas.
async function handleRSC(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return syntheticResponse(503, "text/plain; charset=UTF-8", "");
  }
}

async function handleStatic(request) {
  const coreCache = await caches.open(CACHE_NAMES.core);
  const precached = await coreCache.match(request);
  if (precached) return precached;
  const staticCache = await caches.open(CACHE_NAMES.static);
  const cached = await staticCache.match(request);
  if (cached) return cached;
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    return syntheticResponse(503, "text/plain; charset=UTF-8", "");
  }
  if (response.ok) {
    const clone = response.clone();
    staticCache.put(request, clone).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("Authorization")) return;
  if (url.pathname === "/sw.js") return;

  if (isRSCRequest(request)) {
    event.respondWith(handleRSC(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStatic(request));
    return;
  }
});
