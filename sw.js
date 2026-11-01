/* =====================================================================
   Service worker — fonctionnement hors ligne.
   Stratégie : réseau d'abord pour la page (index.html),
   cache d'abord pour vendor/ et les icônes.
   Les appels à api.anthropic.com ne sont JAMAIS mis en cache.
   Quand vendor/ ou cette liste change : changer CACHE (ex. pm-v2).
   ===================================================================== */
const CACHE = 'pm-v1';
const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/exifr.full.umd.js'
  // Phase 3 : './vendor/exceljs.min.js', './vendor/jszip.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)));
  // Première installation : activation immédiate.
  // Mise à jour : on attend que l'utilisateur touche « Recharger ».
});

self.addEventListener('message', e => {
  if (e.data === 'activer') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Seulement nos propres fichiers, en GET
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Page HTML : réseau d'abord (pour recevoir les mises à jour),
  // repli sur le cache si pas de réponse en 3 s (terrain, hors ligne).
  if (e.request.mode === 'navigate') {
    e.respondWith(pageReseauDabord(e.request));
    return;
  }
  // Autres fichiers (vendor, icônes) : cache d'abord
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(rep => rep || fetch(e.request))
  );
});

async function pageReseauDabord(req) {
  const cache = await caches.open(CACHE);
  const reseau = fetch(req).then(rep => {
    if (rep.ok) cache.put('./index.html', rep.clone());
    return rep;
  });
  const delai = new Promise(r => setTimeout(r, 3000, null));
  try {
    const rep = await Promise.race([reseau, delai]);
    if (rep) return rep;
  } catch { /* hors ligne : on passe au cache */ }
  return (await cache.match('./index.html')) || reseau;
}
