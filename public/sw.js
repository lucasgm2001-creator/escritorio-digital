// Service Worker MÍNIMO e SEGURO (DR Growth — Escritório Digital).
// TRAVA: NUNCA cacheia /api, Supabase (cross-origin) nem HTML autenticado. O dashboard sempre
// mostra dado fresco. Cache-first SÓ em assets estáticos imutáveis com hash, fontes e ícones.

const STATIC_CACHE = 'ed-static-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  // Limpa caches de versões antigas e assume o controle (novos deploys entram sozinhos).
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }

  // Cross-origin (Supabase, Anthropic, etc.) → não intercepta: rede direta, SEM cache.
  if (url.origin !== self.location.origin) return

  // /api → network-only: NUNCA cacheia dados autenticados/dinâmicos.
  if (url.pathname.startsWith('/api/')) return

  // Navegações (HTML do dashboard) → NETWORK-FIRST. Online = sempre fresco; offline = página
  // de fallback do precache. NUNCA cacheia HTML autenticado.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  // Assets estáticos imutáveis (hash do Next), fontes e ícones → CACHE-FIRST.
  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|ttf|otf|eot|png|svg|ico|webp|jpe?g|gif)$/i.test(url.pathname)
  if (cacheable) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE)
      const hit = await cache.match(req)
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res && res.ok) cache.put(req, res.clone())
        return res
      } catch {
        return hit || Response.error()
      }
    })())
    return
  }

  // Demais GET same-origin (não-API, não-asset) → rede direta, sem cachear (dado fresco).
})
