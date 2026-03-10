'use client'

import { useMemo } from 'react'
import { useOfflineCache } from '@/hooks/useOfflineCache'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { MobileSyncContext, type MobileSyncContextValue } from './MobileSyncContext'
import MobileSyncUI from './MobileSyncUI'

interface MobileShellProps {
  farmId: string
  orgSlug: string
  userId: string
  organizationId: string
  children: React.ReactNode
}

/**
 * Wrapper client du layout mobile.
 * Charge le cache IndexedDB, démarre le moteur de sync,
 * et fournit le MobileSyncContext aux formulaires enfants.
 */
export default function MobileShell({
  farmId,
  orgSlug,
  userId,
  organizationId,
  children,
}: MobileShellProps) {
  const { isOnline } = useOnlineStatus()

  const userContext = useMemo(
    () => ({ userId, organizationId, orgSlug }),
    [userId, organizationId, orgSlug],
  )

  const cache = useOfflineCache(farmId, userContext)
  const sync = useSyncQueue(farmId)

  const contextValue = useMemo<MobileSyncContextValue>(
    () => ({
      syncStatus: sync.status,
      isProcessing: sync.isProcessing,
      isAuditing: sync.isAuditing,
      forceSync: sync.forceSync,
      addEntry: sync.addEntry,
      lastSyncResult: sync.lastSyncResult,
      lastAuditResult: sync.lastAuditResult,
      storageEstimate: sync.storageEstimate,
      isOnline,
      farmId,
      orgSlug,
    }),
    [sync, isOnline, farmId, orgSlug],
  )

  // Cache en cours de chargement
  if (cache.isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3 px-4"
        style={{ backgroundColor: '#F9F8F6', color: '#2C3E2D' }}
      >
        <div
          className="w-8 h-8 border-3 rounded-full animate-spin"
          style={{ borderColor: '#e5e5e5', borderTopColor: 'var(--color-primary)' }}
        />
        <p className="text-sm">Chargement des données...</p>
      </div>
    )
  }

  // Erreur + offline sans cache existant
  if (cache.error && !cache.isReady) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center"
        style={{ backgroundColor: '#F9F8F6', color: '#2C3E2D' }}
      >
        <p className="text-lg font-medium">Hors ligne</p>
        <p className="text-sm" style={{ color: '#666' }}>
          {cache.error}
        </p>
        <a
          href={`/${orgSlug}/dashboard`}
          className="text-sm underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Passer en mode bureau
        </a>
      </div>
    )
  }

  return (
    <MobileSyncContext value={contextValue}>
      <MobileSyncUI />
      {children}
    </MobileSyncContext>
  )
}
