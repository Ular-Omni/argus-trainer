// Service worker: сохраняет приложение на телефоне, чтобы оно работало без интернета.
// ВАЖНО: при каждом изменении файлов приложения увеличивайте VERSION — иначе телефон
// продолжит показывать старую версию. Новая версия подхватывается при следующем открытии.
const VERSION = 'v18';
const CACHE = 'argus-' + VERSION;
// Картинки не перечисляем руками: берём их список из art/art.json при установке.
const FILES = [
  './', 'index.html', 'style.css', 'srs.js', 'app.js', 'manifest.json',
  'data/terms.json', 'art/art.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'fonts/sofia-cyrillic.woff2', 'fonts/sofia-cyrillic-ext.woff2', 'fonts/sofia-latin.woff2', 'fonts/sofia-latin-ext.woff2',
  'fonts/instrument-latin.woff2', 'fonts/instrument-latin-ext.woff2'
];

self.addEventListener('install', e => {
  // cache: 'reload' — берём свежие файлы с сервера, а не из кеша браузера
  e.waitUntil((async () => {
    const art = await fetch('art/art.json', { cache: 'reload' }).then(r => r.json());
    const pics = Object.values(art).flatMap(v => Object.values(v)).map(f => 'art/' + f);
    const c = await caches.open(CACHE);
    await c.addAll([...FILES, ...pics].map(f => new Request(f, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('argus-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Сначала из сохранённого, иначе из сети (и тогда тоже сохраняем). Только свои файлы.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
