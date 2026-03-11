import { NextResponse } from 'next/server'

/**
 * GET /api/sw-debug
 * Retourne la configuration du SW côté serveur (headers, scope, URLs).
 * Page de diagnostic temporaire — à supprimer après résolution du problème Safari.
 */
export async function GET() {
  return NextResponse.json({
    swUrl: '/serwist/sw.js',
    scope: '/',
    precachedUrls: ['/', '/offline'],
    runtimeCaches: [
      { name: 'mobile-pages', strategy: 'NetworkFirst', matcher: '/m/', networkTimeoutSeconds: 3 },
      { name: 'pages (defaultCache)', strategy: 'NetworkFirst', matcher: 'same-origin non-API' },
    ],
    fallback: { url: '/offline', matcher: 'request.destination === document' },
    warmCache: { batchSize: 3, throttle: '24h', messageType: 'WARM_CACHE' },
    timestamp: new Date().toISOString(),
  })
}
