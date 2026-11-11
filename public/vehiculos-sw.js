// Service worker SOLO de /vehiculos (se registra con scope '/vehiculos', por eso vive en la raíz).
// Hace que la app se pueda instalar aparte de la intranet. Siempre va primero a la red, así
// nadie se queda con una versión vieja; la copia guardada solo se usa si no hay señal.
const CACHE = 'vehiculos-v1'
const BASICO = ['/vehiculos', '/vehiculos.webmanifest', '/vehiculos/icon-192.png', '/vehiculos/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('vehiculos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Páginas: red primero; sin señal, la última copia de /vehiculos.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/vehiculos', copia))
          return res
        })
        .catch(() => caches.match('/vehiculos')),
    )
    return
  }

  // Íconos y manifiesto: lo guardado, si lo hay.
  if (BASICO.includes(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)))
  }
})
