'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import {
  addToSyncQueue,
  getSyncQueueStatus,
  processSyncQueue,
  purgeOldArchives,
  runAudit,
  type AuditResult,
  type SyncQueueStatus,
  type SyncResult,
} from '@/lib/offline/sync-service'
import {
  checkAndPurgeIfNeeded,
  getStorageEstimate,
} from '@/lib/offline/storage-monitor'

// --- Constantes ---

const SYNC_INTERVAL_MS = 30_000 // 30 secondes
const STORAGE_REFRESH_MS = 60_000 // 60 secondes

// --- Interface publique ---

interface StorageInfo {
  usageFormatted: string
  quotaFormatted: string
  usagePercent: number
}

interface UseSyncQueueReturn {
  status: SyncQueueStatus
  isProcessing: boolean
  lastSyncResult: SyncResult | null
  isAuditing: boolean
  lastAuditResult: AuditResult | null
  forceSync: () => Promise<void>
  addEntry: (params: {
    table_cible: string
    farm_id: string
    payload: Record<string, unknown>
  }) => Promise<string>
  storageEstimate: StorageInfo | null
}

const EMPTY_STATUS: SyncQueueStatus = {
  pending: 0,
  syncing: 0,
  synced: 0,
  error: 0,
  total: 0,
}

/**
 * Hook orchestrateur du moteur de sync.
 * Gère le timer 30s, le sync automatique quand online,
 * et expose les compteurs/actions pour l'UI.
 */
export function useSyncQueue(farmId: string | null): UseSyncQueueReturn {
  const { isOnline, wasOffline } = useOnlineStatus()

  const [status, setStatus] = useState<SyncQueueStatus>(EMPTY_STATUS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [lastAuditResult, setLastAuditResult] = useState<AuditResult | null>(null)
  const [storageEstimate, setStorageEstimate] = useState<StorageInfo | null>(null)

  // Ref pour éviter les cycles concurrents
  const processingRef = useRef(false)
  const auditingRef = useRef(false)

  // --- Rafraîchir les compteurs ---
  const refreshStatus = useCallback(async () => {
    try {
      const newStatus = await getSyncQueueStatus()
      setStatus(newStatus)
    } catch {
      // IndexedDB indisponible — garder l'état précédent
    }
  }, [])

  // --- Rafraîchir l'estimation de stockage ---
  const refreshStorage = useCallback(async () => {
    try {
      const estimate = await getStorageEstimate()
      setStorageEstimate({
        usageFormatted: estimate.usageFormatted,
        quotaFormatted: estimate.quotaFormatted,
        usagePercent: estimate.usagePercent,
      })
    } catch {
      // Storage API indisponible
    }
  }, [])

  // --- Cycle de sync ---
  const runSyncCycle = useCallback(async () => {
    if (processingRef.current || !isOnline) return
    processingRef.current = true
    setIsProcessing(true)

    try {
      const result = await processSyncQueue()
      setLastSyncResult(result)

      // Purge des archives > 7 jours
      await purgeOldArchives()

      // Vérification quota + purge si > 80%
      await checkAndPurgeIfNeeded()
    } catch {
      // Erreur inattendue — le prochain cycle réessaiera
    } finally {
      processingRef.current = false
      setIsProcessing(false)
      await refreshStatus()
      await refreshStorage()
    }
  }, [isOnline, refreshStatus, refreshStorage])

  // --- Force sync (sync + audit + purge) ---
  const forceSync = useCallback(async () => {
    if (!isOnline) return

    // Sync
    if (!processingRef.current) {
      processingRef.current = true
      setIsProcessing(true)
      try {
        const result = await processSyncQueue()
        setLastSyncResult(result)
        await purgeOldArchives()
        await checkAndPurgeIfNeeded()
      } finally {
        processingRef.current = false
        setIsProcessing(false)
      }
    }

    // Audit
    if (!auditingRef.current && farmId) {
      auditingRef.current = true
      setIsAuditing(true)
      try {
        const auditResult = await runAudit(farmId)
        setLastAuditResult(auditResult)
      } finally {
        auditingRef.current = false
        setIsAuditing(false)
      }
    }

    await refreshStatus()
    await refreshStorage()
  }, [isOnline, farmId, refreshStatus, refreshStorage])

  // --- Ajouter une entrée ---
  const addEntry = useCallback(
    async (params: {
      table_cible: string
      farm_id: string
      payload: Record<string, unknown>
    }): Promise<string> => {
      const uuid = await addToSyncQueue(params)
      await refreshStatus()
      return uuid
    },
    [refreshStatus],
  )

  // --- Chargement initial des compteurs ---
  useEffect(() => {
    refreshStatus()
    refreshStorage()
  }, [refreshStatus, refreshStorage])

  // --- Timer 30s quand online ---
  useEffect(() => {
    if (!isOnline) return

    const intervalId = setInterval(() => {
      runSyncCycle()
    }, SYNC_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isOnline, runSyncCycle])

  // --- Sync immédiat au retour online après offline ---
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (wasOffline && !wasOfflineRef.current) {
      wasOfflineRef.current = true
    }
  }, [wasOffline])

  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      wasOfflineRef.current = false
      runSyncCycle()
    }
  }, [isOnline, runSyncCycle])

  // --- Rafraîchissement du stockage toutes les 60s ---
  useEffect(() => {
    if (!isOnline) return

    const intervalId = setInterval(() => {
      refreshStorage()
    }, STORAGE_REFRESH_MS)

    return () => clearInterval(intervalId)
  }, [isOnline, refreshStorage])

  return {
    status,
    isProcessing,
    lastSyncResult,
    isAuditing,
    lastAuditResult,
    forceSync,
    addEntry,
    storageEstimate,
  }
}
