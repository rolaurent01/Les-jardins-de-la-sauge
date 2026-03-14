'use client'

import { createContext, useContext } from 'react'
import type { SyncQueueStatus, SyncResult, AuditResult } from '@/lib/offline/sync-service'

/** Valeurs exposées aux formulaires mobiles via useMobileSync() */
export interface MobileSyncContextValue {
  // Du hook useSyncQueue
  syncStatus: SyncQueueStatus
  isProcessing: boolean
  isAuditing: boolean
  forceSync: () => Promise<void>
  addEntry: (params: {
    table_cible: string
    farm_id: string
    payload: Record<string, unknown>
  }) => Promise<string>
  lastSyncResult: SyncResult | null
  lastAuditResult: AuditResult | null
  storageEstimate: {
    usageFormatted: string
    quotaFormatted: string
    usagePercent: number
  } | null

  // Du hook useOfflineCache
  isOnline: boolean
  lastSyncedAt: string | null
  refreshCache: () => Promise<void>
  isRefreshing: boolean

  // Contexte ferme
  farmId: string
  orgSlug: string
  certifBio: boolean
}

export const MobileSyncContext = createContext<MobileSyncContextValue | null>(null)

/**
 * Hook pour accéder au contexte de sync mobile.
 * À utiliser dans les formulaires mobiles (A6.6).
 */
export function useMobileSync(): MobileSyncContextValue {
  const ctx = useContext(MobileSyncContext)
  if (!ctx) {
    throw new Error('useMobileSync doit être utilisé dans un <MobileShell>')
  }
  return ctx
}
