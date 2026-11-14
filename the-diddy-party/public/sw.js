/* Service worker: keeps the site installable. Offline, it shows only the "something went wrong" screen. */
const CACHE = "diddy-v3", OFFLINE = "/offline.html", PIC = "/images/Mbappe.png";
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([c.add(OFFLINE), c.add(PIC).catch(() => {})])));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin === location.origin && u.pathname === PIC) {
    return e.respondWith(caches.match(PIC).then(hit => hit || fetch(e.request)));
  }
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
