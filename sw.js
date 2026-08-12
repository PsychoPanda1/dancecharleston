const CACHE_NAME = "dance-charleston-v2";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/tango.html",
  "/offline.html",
  "/styles.css?v=20260811-share-contrast",
  "/script.js?v=20260811-share-offline",
  "/site.webmanifest",
  "/assets/dancecharleston-icon.jpg",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("/offline.html")),
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
