/* HEXA – Service Worker: Damit startet die App auch ohne Internet, etwa als App auf dem Home-Bildschirm.
   Beim ersten Öffnen legt er alle Dateien der App auf dem Gerät ab (rund 0,7 MB).
   Code (HTML, CSS, JS, Sprachen, Manifest): Netz zuerst. Die Kopie kommt nur, wenn das Netz fehlt oder zu lange
   braucht. So kommen Updates und Änderungen in js/config.js sofort an, eine Versionsnummer braucht es nicht.
   Schriften und Icons: Kopie zuerst, im Hintergrund wird sie aufgefrischt. Die ändern sich kaum.
   Alles andere (etwa health für die Server-Suche) geht unverändert ans Netz, WebSockets laufen nie hierüber.
   Ob die Liste vollständig ist, prüft tests/sw.test.js. */
'use strict';

const CACHE = 'hexa-app';
const FILES = [
  'index.html', 'favicon.svg', 'manifest.webmanifest',
  'css/hexa.css',
  'js/theme-init.js', 'js/config.js', 'js/i18n.js', 'js/rules.js', 'js/bot.js', 'js/sound.js', 'js/online.js', 'js/app.js',
  'lang/de.js', 'lang/en.js',
  'fonts/archivo/archivo-latin.woff2', 'fonts/archivo/archivo-latin-ext.woff2', 'fonts/archivo/archivo-vietnamese.woff2',
  'fonts/kalam/kalam-700-latin.woff2',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];
const WAIT = 3000;                 // so lange bekommt das Netz, dann nimmt die App ihre Kopie
const SLOW = 10000;                // war das Netz zu langsam, kommen so lange gleich die Kopien
let slowUntil = 0;
const STILL = /^(fonts|icons)\//;  // Kopie zuerst

const keyOf = file => new URL(file, self.registration.scope).href;

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den Browser-Cache, damit wirklich der aktuelle Stand abgelegt wird
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(keyOf(f), { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const scope = self.registration.scope;
  const url = new URL(req.url);
  if (!url.href.startsWith(scope)) return;
  let file = url.pathname.slice(new URL(scope).pathname.length);
  if (req.mode === 'navigate' && file === '') file = 'index.html';
  if (!FILES.includes(file)) return;
  e.respondWith(STILL.test(file) ? copyFirst(keyOf(file), e) : netFirst(keyOf(file), e));
});

// Antwort ablegen. Die Kopie entsteht sofort, noch bevor die Seite die Antwort liest.
function keep(key, res) {
  if (!res.ok) return Promise.resolve();
  const copy = res.clone();
  return caches.open(CACHE).then(c => c.put(key, copy));
}

async function netFirst(key, e) {
  const net = fetch(key, { cache: 'no-cache' }).then(res => { e.waitUntil(keep(key, res)); return res; });
  e.waitUntil(net.catch(() => null));
  // Gerade erst zu langsam gewesen: nicht bei jeder Datei wieder warten. Im Hintergrund wird trotzdem aufgefrischt.
  if (Date.now() < slowUntil) {
    const hit = await caches.match(key);
    if (hit) return hit;
  }
  let res = null;
  try {
    res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('zu langsam')), WAIT))]);
    if (res.ok) return res;
  } catch (err) {
    if (err.message === 'zu langsam') slowUntil = Date.now() + SLOW;
  }
  const hit = await caches.match(key);
  if (hit) return hit;
  // Keine Kopie da (etwa beim allerersten Öffnen): dann eben aufs Netz warten
  return res || net;
}

function copyFirst(key, e) {
  const net = fetch(key).then(res => { e.waitUntil(keep(key, res)); return res; });
  e.waitUntil(net.catch(() => null));
  return caches.match(key).then(hit => hit || net);
}
