'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getMobileRoutes } from '@/lib/offline/mobile-routes'

// Types pour les données de diagnostic
interface SwInfo {
  controllerUrl: string | null
  scope: string | null
  state: string | null
  installing: boolean
  waiting: boolean
  active: boolean
}

interface CacheInfo {
  cacheNames: string[]
  mobilePagesCount: number
  mobilePagesUrls: string[]
}

interface IdbInfo {
  hasContext: boolean
  farmId: string | null
  varietiesCount: number
  syncQueueCount: number
  lastSyncedAt: string | null
}

type Status = 'ok' | 'warn' | 'error' | 'loading'

/** Page de diagnostic Service Worker — accessible depuis /m/debug */
export default function SwDebugPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = params.orgSlug

  const [swInfo, setSwInfo] = useState<SwInfo | null>(null)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [idbInfo, setIdbInfo] = useState<IdbInfo | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [warmCacheAt, setWarmCacheAt] = useState<string | null>(null)
  const [fetchResult, setFetchResult] = useState<string | null>(null)
  const [swUrlCheck, setSwUrlCheck] = useState<string | null>(null)
  const [actionLog, setActionLog] = useState<string[]>([])

  const log = useCallback((msg: string) => {
    setActionLog((prev) => [...prev, `[${new Date().toLocaleTimeString('fr-FR')}] ${msg}`])
  }, [])

  // --- Diagnostic SW ---
  const checkSw = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setSwInfo({
        controllerUrl: null, scope: null, state: null,
        installing: false, waiting: false, active: false,
      })
      return
    }

    const reg = await navigator.serviceWorker.getRegistration()
    setSwInfo({
      controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
      scope: reg?.scope ?? null,
      state: reg?.active?.state ?? null,
      installing: !!reg?.installing,
      waiting: !!reg?.waiting,
      active: !!reg?.active,
    })
  }, [])

  // --- Diagnostic Cache Storage ---
  const checkCaches = useCallback(async () => {
    if (!('caches' in self)) {
      setCacheInfo({ cacheNames: [], mobilePagesCount: 0, mobilePagesUrls: [] })
      return
    }

    const names = await caches.keys()
    let mobilePagesUrls: string[] = []
    try {
      const cache = await caches.open('mobile-pages')
      const keys = await cache.keys()
      mobilePagesUrls = keys.map((r) => new URL(r.url).pathname)
    } catch {
      // cache n'existe pas encore
    }

    setCacheInfo({
      cacheNames: names,
      mobilePagesCount: mobilePagesUrls.length,
      mobilePagesUrls,
    })
  }, [])

  // --- Diagnostic IndexedDB ---
  const checkIdb = useCallback(async () => {
    try {
      const { offlineDb } = await import('@/lib/offline/db')
      const ctx = await offlineDb.context.get('current')
      const varietiesCount = await offlineDb.varieties.count()
      const syncQueueCount = await offlineDb.syncQueue.count()

      setIdbInfo({
        hasContext: !!ctx,
        farmId: ctx?.farmId ?? null,
        varietiesCount,
        syncQueueCount,
        lastSyncedAt: ctx?.lastSyncedAt ?? null,
      })
    } catch {
      setIdbInfo({
        hasContext: false, farmId: null,
        varietiesCount: 0, syncQueueCount: 0, lastSyncedAt: null,
      })
    }
  }, [])

  // --- Chargement initial + refresh ---
  const refreshAll = useCallback(async () => {
    setIsOnline(navigator.onLine)
    setWarmCacheAt(localStorage.getItem('ljs-warm-cache-at'))
    await Promise.all([checkSw(), checkCaches(), checkIdb()])
  }, [checkSw, checkCaches, checkIdb])

  useEffect(() => {
    refreshAll()

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refreshAll])

  // --- Actions ---
  const handleCheckSwUrl = async () => {
    setSwUrlCheck(null)
    const swUrl = '/serwist/sw.js'
    try {
      const res = await fetch(swUrl)
      const contentType = res.headers.get('content-type') ?? '(absent)'
      const bodySize = (await res.clone().text()).length
      const info = `${res.status} ${res.statusText} | Content-Type: ${contentType} | ${bodySize} octets`
      setSwUrlCheck(info)
      log(`SW URL check: ${info}`)
      if (!contentType.includes('javascript')) {
        log(`PROBLEME: Content-Type n'est pas JavaScript — le proxy redirige probablement vers /login`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSwUrlCheck(`ERREUR: ${msg}`)
      log(`SW URL check ERREUR: ${msg}`)
    }
  }

  const handleTestFetch = async () => {
    setFetchResult(null)
    const url = `/${orgSlug}/m/saisie`
    try {
      const start = performance.now()
      const res = await fetch(url, { credentials: 'same-origin' })
      const elapsed = Math.round(performance.now() - start)
      setFetchResult(
        `${res.status} ${res.statusText} — ${elapsed} ms — ` +
        `${res.headers.get('x-nextjs-cache') ?? 'no cache header'}`
      )
      log(`Fetch ${url} → ${res.status} (${elapsed} ms)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFetchResult(`ERREUR: ${msg}`)
      log(`Fetch ${url} ERREUR: ${msg}`)
    }
  }

  const handleForceRegister = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/serwist/sw.js', {
        scope: '/',
        type: 'module',
      })
      log(`SW enregistré — scope: ${reg.scope}, state: ${reg.active?.state ?? 'installing'}`)
      await refreshAll()
    } catch (err) {
      log(`Erreur enregistrement SW: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleWarmCache = () => {
    if (!navigator.serviceWorker.controller) {
      log('Pas de SW controller — impossible de lancer le warm cache')
      return
    }

    const urls = getMobileRoutes(orgSlug)
    navigator.serviceWorker.controller.postMessage({
      type: 'WARM_CACHE',
      urls,
    })
    log(`WARM_CACHE envoyé (${urls.length} URLs)`)

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'WARM_CACHE_DONE') {
        log(`WARM_CACHE_DONE — ${event.data.cached} pages cachées`)
        localStorage.setItem('ljs-warm-cache-at', Date.now().toString())
        navigator.serviceWorker.removeEventListener('message', handler)
        refreshAll()
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
  }

  const handleClearWarmFlag = () => {
    localStorage.removeItem('ljs-warm-cache-at')
    setWarmCacheAt(null)
    log('Flag warm cache supprimé')
  }

  // --- Rendu ---
  return (
    <div className="px-4 py-4 flex flex-col gap-4 text-sm" style={{ color: '#2C3E2D' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Diagnostic SW</h1>
        <button
          type="button"
          onClick={refreshAll}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ backgroundColor: '#F3F4F6' }}
        >
          Rafraîchir
        </button>
      </div>

      {/* Section Service Worker */}
      <DiagSection title="Service Worker">
        <DiagRow
          label="Controller"
          value={swInfo?.controllerUrl ? shortUrl(swInfo.controllerUrl) : 'null'}
          status={swInfo?.controllerUrl ? 'ok' : 'error'}
        />
        <DiagRow
          label="Scope"
          value={swInfo?.scope ?? '—'}
          status={swInfo?.scope === `${location.origin}/` ? 'ok' : 'warn'}
        />
        <DiagRow
          label="State"
          value={swInfo?.state ?? '—'}
          status={swInfo?.state === 'activated' ? 'ok' : 'warn'}
        />
        <DiagRow label="Installing" value={swInfo?.installing ? 'oui' : 'non'} status={swInfo?.installing ? 'warn' : 'ok'} />
        <DiagRow label="Waiting" value={swInfo?.waiting ? 'oui' : 'non'} status={swInfo?.waiting ? 'warn' : 'ok'} />
        <DiagRow label="Active" value={swInfo?.active ? 'oui' : 'non'} status={swInfo?.active ? 'ok' : 'error'} />
      </DiagSection>

      {/* Section Cache Storage */}
      <DiagSection title="Cache Storage">
        <DiagRow
          label="Caches"
          value={cacheInfo?.cacheNames.join(', ') || '(vide)'}
          status={cacheInfo && cacheInfo.cacheNames.length > 0 ? 'ok' : 'warn'}
        />
        <DiagRow
          label="mobile-pages"
          value={`${cacheInfo?.mobilePagesCount ?? 0} entrées`}
          status={cacheInfo && cacheInfo.mobilePagesCount > 0 ? 'ok' : 'warn'}
        />
        {cacheInfo && cacheInfo.mobilePagesUrls.length > 0 && (
          <details className="mt-1">
            <summary className="text-xs cursor-pointer" style={{ color: '#6B7280' }}>
              Voir les URLs cachées ({cacheInfo.mobilePagesCount})
            </summary>
            <ul className="mt-1 text-xs pl-3" style={{ color: '#6B7280' }}>
              {cacheInfo.mobilePagesUrls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </details>
        )}
      </DiagSection>

      {/* Section Réseau */}
      <DiagSection title="Réseau">
        <DiagRow
          label="navigator.onLine"
          value={isOnline ? 'en ligne' : 'hors ligne'}
          status={isOnline ? 'ok' : 'warn'}
        />
        <DiagRow
          label="Dernier warm cache"
          value={warmCacheAt ? formatTimestamp(parseInt(warmCacheAt, 10)) : 'jamais'}
          status={warmCacheAt ? 'ok' : 'warn'}
        />
      </DiagSection>

      {/* Section IndexedDB */}
      <DiagSection title="IndexedDB (offline)">
        <DiagRow
          label="Contexte offline"
          value={idbInfo?.hasContext ? 'oui' : 'non'}
          status={idbInfo?.hasContext ? 'ok' : 'error'}
        />
        <DiagRow label="Farm ID" value={idbInfo?.farmId ?? '—'} status={idbInfo?.farmId ? 'ok' : 'warn'} />
        <DiagRow
          label="Variétés en cache"
          value={String(idbInfo?.varietiesCount ?? 0)}
          status={idbInfo && idbInfo.varietiesCount > 0 ? 'ok' : 'warn'}
        />
        <DiagRow
          label="Saisies en queue"
          value={String(idbInfo?.syncQueueCount ?? 0)}
          status="ok"
        />
        <DiagRow
          label="Dernier sync IDB"
          value={idbInfo?.lastSyncedAt ?? '—'}
          status={idbInfo?.lastSyncedAt ? 'ok' : 'warn'}
        />
      </DiagSection>

      {/* Actions */}
      <DiagSection title="Actions">
        <div className="flex flex-col gap-2">
          <ActionButton label="Vérifier URL SW (/serwist/sw.js)" onClick={handleCheckSwUrl} />
          {swUrlCheck && (
            <p className="text-xs px-2 py-1 rounded font-mono" style={{
              backgroundColor: swUrlCheck.includes('javascript') ? '#ECFDF5' : '#FEF2F2',
              color: swUrlCheck.includes('javascript') ? '#065F46' : '#991B1B',
            }}>
              {swUrlCheck}
            </p>
          )}
          <ActionButton label="Forcer enregistrement SW" onClick={handleForceRegister} />
          <ActionButton label="Tester fetch /m/saisie" onClick={handleTestFetch} />
          {fetchResult && (
            <p className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>
              {fetchResult}
            </p>
          )}
          <ActionButton label="Lancer warm cache" onClick={handleWarmCache} />
          <ActionButton label="Reset flag warm cache (24h)" onClick={handleClearWarmFlag} variant="secondary" />
        </div>
      </DiagSection>

      {/* Journal */}
      {actionLog.length > 0 && (
        <DiagSection title="Journal">
          <div
            className="text-xs font-mono p-2 rounded-lg max-h-40 overflow-y-auto"
            style={{ backgroundColor: '#1F2937', color: '#D1D5DB' }}
          >
            {actionLog.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))}
          </div>
        </DiagSection>
      )}
    </div>
  )
}

// --- Composants internes ---

function DiagSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}>
      <h2 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function DiagRow({ label, value, status }: { label: string; value: string; status: Status }) {
  const badge = status === 'ok' ? '🟢' : status === 'warn' ? '🟡' : status === 'error' ? '🔴' : '⏳'
  return (
    <div className="flex items-start justify-between py-1 gap-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <span className="text-xs" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-xs text-right font-mono flex items-center gap-1" style={{ color: '#374151', maxWidth: '60%', wordBreak: 'break-all' }}>
        <span>{badge}</span>
        <span>{value}</span>
      </span>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  variant = 'primary',
}: {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-sm font-medium"
      style={{
        backgroundColor: variant === 'primary' ? '#3A5A40' : '#F3F4F6',
        color: variant === 'primary' ? '#fff' : '#374151',
        borderRadius: 10,
        minHeight: 44,
        border: 'none',
      }}
    >
      {label}
    </button>
  )
}

function shortUrl(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const ago = Math.round((Date.now() - ts) / 60000)
  return `${d.toLocaleTimeString('fr-FR')} (il y a ${ago} min)`
}
