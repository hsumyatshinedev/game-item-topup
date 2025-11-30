const CACHE_NAME = "faygo-store-v1";
const urlsToCache = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});


self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});