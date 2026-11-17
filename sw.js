const CACHE_NAME = 'eastra-cache-v5';
const STATIC_ASSETS = [
  './manifest.json',
  './Logo%20Azzuha.png'
];

// Pasang Service Worker dan terus aktifkan tanpa menunggu tab lama ditutup
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

// Padam semua versi cache lama secara automatik semasa pengaktifan
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Strategi Network-First untuk HTML & API supaya versi baharu sentiasa dimuatkan dahulu
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Abaikan permintaan bukan GET atau panggilan ke Google Apps Script / GitHub API
  if (req.method !== 'GET' || url.hostname.includes('script.google.com') || url.hostname.includes('api.github.com')) {
    return;
  }

  // Untuk navigasi halaman (index.html), sentiasa cuba rangkaian (Network-First) dahulu
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(networkRes => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Untuk aset statik lain (ikon, manifest, font), guna Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then(cachedRes => {
      const fetchPromise = fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

// Terima arahan SKIP_WAITING daripada banner kemas kini index.html
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
