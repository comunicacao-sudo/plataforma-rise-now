/* Apenas a tela pública sem conexão e os ícones são guardados neste cache.
   HTML da plataforma, sessões, respostas, APIs, capas privadas e vídeos seguem pela rede. */
const CACHE = "rise-public-offline-v1";
const OFFLINE = "/offline.html";
const PUBLIC_FILES = [OFFLINE, "/app-icons/icon-192.png", "/app-icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PUBLIC_FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("rise-public-offline-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE)) ?? Response.error()),
    );
  } else if (!url.search && PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
