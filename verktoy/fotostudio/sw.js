/* Fotostudio – lagrer filene på enheten, så siden virker uten internett.
   Har du byttet ut filer i «lib» eller «fonts»? Øk tallet i VERSJON (v1 → v2), så hentes de på nytt.
   Endringer i index.html kommer av seg selv neste gang siden åpnes med nett. */
const VERSJON = 'fotostudio-v1';
const FILER = [
  './',
  'index.html',
  'lib/vision_bundle.mjs',
  'lib/wasm/vision_wasm_internal.js',
  'lib/wasm/vision_wasm_internal.wasm',
  'lib/selfie_multiclass_256x256.tflite',
  'fonts/bricolage-grotesque-latin-700-normal.woff2',
  'fonts/bricolage-grotesque-latin-800-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/space-mono-latin-400-normal.woff2',
  'fonts/space-mono-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSJON).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((navn) => Promise.all(navn.filter((n) => n.startsWith('fotostudio-') && n !== VERSJON).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function fraLager(req) {
  const c = await caches.open(VERSJON);
  return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? c.match('index.html') : undefined);
}

async function nettForst(req) {            // selve siden: ny utgave hvis vi har nett, ellers den lagrede
  try {
    const svar = await Promise.race([
      fetch(req),
      new Promise((_, avvis) => setTimeout(() => avvis(new Error('tregt nett')), 3500)),
    ]);
    if (svar.ok) { const c = await caches.open(VERSJON); c.put('index.html', svar.clone()); }
    return svar;
  } catch (feil) {
    const lagret = await fraLager(req);
    if (lagret) return lagret;
    throw feil;
  }
}

async function lagerForst(req) {           // store filer som aldri endrer seg: bruk den lagrede
  const lagret = await fraLager(req);
  if (lagret) return lagret;
  const svar = await fetch(req);
  if (svar.ok) { const c = await caches.open(VERSJON); c.put(req, svar.clone()); }
  return svar;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const erSiden = req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html');
  e.respondWith(erSiden ? nettForst(req) : lagerForst(req));
});
