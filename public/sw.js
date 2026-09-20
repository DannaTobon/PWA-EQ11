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

function isCurrentVersionCache(cacheName) {
  return cacheName.startsWith(VERSION_PREFIX) && EXPECTED_CACHES.has(cacheName);
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