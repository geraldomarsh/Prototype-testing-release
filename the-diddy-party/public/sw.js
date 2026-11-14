/* Service worker: keeps the site installable. Offline, it shows only the "something went wrong" screen. Nothing else is saved. */
const CACHE = "diddy-v2", OFFLINE = "/offline.html";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;                 // only page loads; everything else goes straight to the network
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});