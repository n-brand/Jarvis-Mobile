/**
 * Service worker for the installed app.
 *
 * Only this site's own files are cached, so the interface still opens
 * without a connection (JARVIS itself needs the network to answer). Requests
 * to any other host — the Claude API above all — are never touched: they go
 * straight to the network and nothing of a conversation is ever stored.
 *
 * Network first, cache as fallback: a new deploy is picked up on the next
 * launch instead of being hidden behind a stale copy.
 */
const CACHE = 'jarvis-mobile-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', 'manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // Offline and never seen: fall back to the app shell for page loads.
        if (request.mode === 'navigate') return caches.match('./')
        return Response.error()
      }),
  )
})
