import { getMobileRoutes } from './mobile-routes'

const WARM_CACHE_KEY = 'ljs-warm-cache-at'
const WARM_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 h

/**
 * Demande au Service Worker de précacher toutes les pages mobiles.
 * Ne se relance pas si déjà fait il y a moins de 24 h.
 */
export function warmMobileCache(orgSlug: string): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return

  const lastWarm = localStorage.getItem(WARM_CACHE_KEY)
  if (lastWarm && Date.now() - parseInt(lastWarm, 10) < WARM_CACHE_TTL) return

  const urls = getMobileRoutes(orgSlug)

  navigator.serviceWorker.controller.postMessage({
    type: 'WARM_CACHE',
    urls,
  })

  // Écouter la confirmation du SW
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'WARM_CACHE_DONE') {
      localStorage.setItem(WARM_CACHE_KEY, Date.now().toString())
      navigator.serviceWorker.removeEventListener('message', handler)
    }
  }
  navigator.serviceWorker.addEventListener('message', handler)
}
