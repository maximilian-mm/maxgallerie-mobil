// Hält die App-Dateien auf dem Gerät vor, damit sie auch ohne erreichbaren Webserver startet.
// Bilder und Katalog kommen immer frisch aus OneDrive und werden hier nicht zwischengespeichert.
const CACHE = 'maxgallerie-mobil-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Erst das Netz (so kommen Aktualisierungen sofort an), bei Ausfall die gespeicherte Fassung
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./'))),
  );
});
