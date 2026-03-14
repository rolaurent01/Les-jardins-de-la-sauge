"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { loadReferenceData, isCacheValid } from '@/lib/offline/cache-loader'
import { saveOfflineContext, getOfflineContext } from '@/lib/offline/context-offline'

interface UseOfflineCacheResult {
  /** true quand le cache est chargé ou en mode offline avec cache existant */
  isReady: boolean
  /** true pendant le chargement du cache */
  isLoading: boolean
  /** Message d'erreur si le chargement échoue */
  error: string | null
  /** Timestamp ISO du dernier chargement réussi */
  lastSyncedAt: string | null
}

/**
 * Hook qui orchestre le chargement du cache IndexedDB au montage.
 *
 * - Online + cache invalide → charge les données de référence
 * - Online + cache valide → ne fait rien
 * - Offline + contexte existant → utilise le cache existant
 * - Offline + pas de contexte → affiche un message d'erreur
 *
 * @param farmId — ID de la ferme active (depuis cookie active_farm_id)
 * @param userContext — Contexte utilisateur à sauvegarder offline
 */
export function useOfflineCache(
  farmId: string | null,
  userContext: {
    userId: string
    organizationId: string
    orgSlug: string
    certifBio: boolean
  } | null
): UseOfflineCacheResult {
  const { isOnline } = useOnlineStatus()
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  // Éviter les doubles exécutions en mode strict
  const initRef = useRef(false)

  const initialize = useCallback(async () => {
    if (!farmId) return

    setIsLoading(true)
    setError(null)

    try {
      if (isOnline) {
        // Sauvegarder le contexte offline si disponible
        if (userContext) {
          await saveOfflineContext({
            userId: userContext.userId,
            farmId,
            organizationId: userContext.organizationId,
            orgSlug: userContext.orgSlug,
            certifBio: userContext.certifBio,
          })
        }

        // Vérifier si le cache est valide
        const valid = await isCacheValid(farmId)
        if (!valid) {
          await loadReferenceData(farmId)
        }

        // Lire le timestamp de dernière sync
        const ctx = await getOfflineContext()
        setLastSyncedAt(ctx?.lastSyncedAt ?? null)
        setIsReady(true)
      } else {
        // Mode offline : vérifier qu'un contexte existe
        const ctx = await getOfflineContext()
        if (ctx && ctx.farmId === farmId) {
          setLastSyncedAt(ctx.lastSyncedAt)
          setIsReady(true)
        } else {
          setError('Connectez-vous une première fois pour utiliser le mode offline')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [farmId, isOnline, userContext])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initialize()
  }, [initialize])

  return { isReady, isLoading, error, lastSyncedAt }
}
