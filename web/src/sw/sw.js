/* Service Worker de Ludus. Plantilla: el build (vite.config.ts) inyecta la versión y la lista de archivos.
 * Estrategia (guía §3.3): todo lo de la app se precachea y se sirve cache-first;
 * las navegaciones reciben index.html desde la caché (la app funciona sin conexión).
 * No hay datos remotos: los datos viven en IndexedDB. */
'use strict';

const VERSION = '__LUDUS_VERSION__';
const CACHE = `ludus-${VERSION}`;
const PRECACHE = [] /* __LUDUS_PRECACHE__ */;

const aUrl = (ruta) => new URL(ruta, self.registration.scope).href;
// ignoreVary: algunos servidores responden "Vary: Origin" y las peticiones de módulos
// (crossorigin) traen Origin; sin esto no coincidirían con lo precacheado y fallarían sin red.
const OPCIONES_DE_BUSQUEDA = { ignoreVary: true };

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(aUrl))));
  // Sin skipWaiting: la nueva versión espera a que el usuario pulse "Actualizar".
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('ludus-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SALTAR_ESPERA') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;

  if (peticion.mode === 'navigate') {
    evento.respondWith(
      caches.match(aUrl('./index.html'), OPCIONES_DE_BUSQUEDA).then((enCache) => enCache || fetch(peticion)),
    );
    return;
  }
  evento.respondWith(caches.match(peticion, OPCIONES_DE_BUSQUEDA).then((enCache) => enCache || fetch(peticion)));
});
