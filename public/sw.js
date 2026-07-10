// Service worker for HabitTracker PWA.
//
// The BUILD_ID placeholder below is replaced at build time with the git SHA.
// This ensures the SW file itself changes on every deploy, triggering browser
// update detection. Without it, the browser might not notice the deploy for
// 24+ hours.
//
// Strategy:
// - HTML / JS / CSS / fonts / icons   → stale-while-revalidate
// - Supabase / other external APIs    → bypass (let network handle)
//
// Stale-while-revalidate: serve from cache instantly, fetch fresh in
// background, update cache. Keep SW alive via event.waitUntil() so the
// background fetch completes before SW shuts down.

const BUILD_ID = '__HT_BUILD_ID__'
const CACHE_NAME = 'ht-cache-' + BUILD_ID

const isHtmlRequest = (request) => request.mode === 'navigate' || request.destination === 'document'
const isAssetRequest = (request) => {
  const dest = request.destination
  return dest === 'script' || dest === 'style' || dest === 'font' || dest === 'image' || dest === 'manifest'
}
const isSupabaseRequest = (url) => url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Never cache Supabase — it's real-time data.
  if (isSupabaseRequest(url)) {
    return
  }

  // Only same-origin HTML / assets go through the cache.
  if (url.origin !== self.location.origin) return
  if (!isHtmlRequest(request) && !isAssetRequest(request)) return

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  event.waitUntil(fetchPromise)

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const networkResp = await fetchPromise
      if (networkResp) return networkResp
      return new Response('Offline and not cached', {
        status: 503,
        statusText: 'Service Unavailable',
      })
    })()
  )
})
