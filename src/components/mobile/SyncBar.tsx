'use client'

import { useMobileSync } from './MobileSyncContext'
import { formatRelativeTime } from '@/lib/utils/format'

/** Configuration visuelle pour chaque état de la barre de sync */
interface SyncBarState {
  text: string
  bgColor: string
  textColor: string
  showSpinner: boolean
}

/** Détermine l'état visuel selon la priorité définie (context.md §3.2) */
function getSyncBarState(params: {
  isAuditing: boolean
  isProcessing: boolean
  errorCount: number
  isOnline: boolean
  pendingCount: number
}): SyncBarState {
  const { isAuditing, isProcessing, errorCount, isOnline, pendingCount } = params

  // 1. Audit en cours
  if (isAuditing) {
    return {
      text: '🔍 Vérification en cours...',
      bgColor: '#DBEAFE',
      textColor: '#1E40AF',
      showSpinner: true,
    }
  }

  // 2. Sync en cours
  if (isProcessing) {
    return {
      text: '⏳ Synchronisation...',
      bgColor: '#FEF3C7',
      textColor: '#92400E',
      showSpinner: true,
    }
  }

  // 3. Erreurs de sync
  if (errorCount > 0) {
    return {
      text: `❌ ${errorCount} erreur${errorCount > 1 ? 's' : ''} de sync`,
      bgColor: '#FEE2E2',
      textColor: '#991B1B',
      showSpinner: false,
    }
  }

  // 4. Hors ligne avec saisies en attente
  if (!isOnline && pendingCount > 0) {
    return {
      text: `📴 Hors ligne — ${pendingCount} saisie${pendingCount > 1 ? 's' : ''} en attente`,
      bgColor: '#F3F4F6',
      textColor: '#374151',
      showSpinner: false,
    }
  }

  // 5. Hors ligne simple
  if (!isOnline) {
    return {
      text: '📴 Hors ligne',
      bgColor: '#F3F4F6',
      textColor: '#374151',
      showSpinner: false,
    }
  }

  // 6. En ligne avec saisies en cours d'envoi
  if (pendingCount > 0) {
    return {
      text: `⏳ ${pendingCount} saisie${pendingCount > 1 ? 's' : ''} en cours d'envoi...`,
      bgColor: '#FEF3C7',
      textColor: '#92400E',
      showSpinner: true,
    }
  }

  // 7. Tout synchronisé
  return {
    text: '✅ Tout synchronisé',
    bgColor: '#DCFCE7',
    textColor: '#166534',
    showSpinner: false,
  }
}

interface SyncBarProps {
  onTap: () => void
}

/**
 * Barre de sync permanente affichée sous le header mobile.
 * Affiche l'état de la sync en un coup d'œil (7 états possibles).
 * Cliquable → ouvre le SyncPanel.
 */
export default function SyncBar({ onTap }: SyncBarProps) {
  const { syncStatus, isProcessing, isAuditing, isOnline, lastSyncedAt, isRefreshing } = useMobileSync()

  const state = getSyncBarState({
    isAuditing,
    isProcessing,
    errorCount: syncStatus.error,
    isOnline,
    pendingCount: syncStatus.pending,
  })

  const cacheLabel = isRefreshing
    ? 'Cache…'
    : `Cache : ${formatRelativeTime(lastSyncedAt)}`

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center justify-between px-3 flex-shrink-0"
      style={{
        height: 40,
        backgroundColor: state.bgColor,
        color: state.textColor,
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center gap-2">
        {state.showSpinner && (
          <span
            className="inline-block w-3.5 h-3.5 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'transparent',
              borderTopColor: state.textColor,
              borderRightColor: state.textColor,
            }}
          />
        )}
        <span>{state.text}</span>
      </div>
      <span style={{ fontSize: 11, opacity: 0.75 }}>{cacheLabel}</span>
    </button>
  )
}
