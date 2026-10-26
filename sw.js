// Обследование ВОЛС — работа без интернета: программа и карта-библиотека в кэше, плитки карты — по мере просмотра.
const V = 'obsled-1.0.2';
const TILES = 'obsled-tiles';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './leaflet.js', './leaflet.css'];
const TILE_HOST = /(^|\.)tile\.openstreetmap\.org$|(^|\.)maps\.2gis\.com$|(^|\.)arcgisonline\.com$/;

self.addEventListener('install', e => {
  // мимо HTTP-кэша браузера (GitHub Pages отдаёт файлы с кэшем на 10 мин) — иначе новая версия запишет старые файлы
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('obsled-') && k !== V && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// страница: сначала сеть (свежая версия), за 3,5 с не ответила — из кэша
function netFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const cached = () => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./'));
    const timer = setTimeout(() => cached().then(finish), 3500);
    fetch(req, {cache: 'no-cache'}).then(r => {   // no-cache: сверка с сайтом (304, если не менялась)
      clearTimeout(timer);
      if (r && r.ok) { const c = r.clone(); caches.open(V).then(ca => ca.put(req, c)); }
      finish(r);
    }).catch(() => {
      clearTimeout(timer);
      cached().then(r => finish(r || Response.error()));
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(netFirst(req)); return; }
    e.respondWith(caches.match(req, {ignoreSearch: true}).then(r => r || fetch(req).then(resp => {
      if (resp.ok) { const c = resp.clone(); caches.open(V).then(ca => ca.put(req, c)); }
      return resp;
    })));
    return;
  }
  if (TILE_HOST.test(u.hostname)) {
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(r => r || fetch(req).then(resp => {
      if (resp.ok || resp.type === 'opaque') c.put(req, resp.clone());
      return resp;
    }))));
  }
});
