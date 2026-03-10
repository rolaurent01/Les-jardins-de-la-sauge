'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMobileSync } from './MobileSyncContext'
import { offlineDb, type SyncQueueEntry } from '@/lib/offline/db'

// --- Labels FR pour les tables ---

const TABLE_LABELS: Record<string, string> = {
  seed_lots: 'Sachet de graines',
  seedlings: 'Suivi semis',
  soil_works: 'Travail de sol',
  plantings: 'Plantation',
  row_care: 'Suivi de rang',
  harvests: 'Cueillette',
  uprootings: 'Arrachage',
  occultations: 'Occultation',
  cuttings: 'Tronçonnage',
  dryings: 'Séchage',
  sortings: 'Triage',
  stock_purchases: 'Achat',
  stock_direct_sales: 'Vente directe',
  stock_adjustments: 'Ajustement',
  production_lots: 'Production de lot',
}

interface SyncPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * Panneau de détail sync — s'ouvre au tap sur la SyncBar.
 * Affiche compteurs, boutons d'action, résultat d'audit, stockage, erreurs.
 */
export default function SyncPanel({ open, onClose }: SyncPanelProps) {
  const {
    syncStatus,
    isProcessing,
    isAuditing,
    isOnline,
    forceSync,
    lastAuditResult,
    storageEstimate,
  } = useMobileSync()

  const [errorEntries, setErrorEntries] = useState<SyncQueueEntry[]>([])
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [isPurging, setIsPurging] = useState(false)

  // Charger les saisies en erreur quand le panneau s'ouvre
  const loadErrors = useCallback(async () => {
    try {
      const entries = await offlineDb.syncQueue
        .where('status')
        .equals('error')
        .toArray()
      setErrorEntries(entries)
    } catch {
      // IndexedDB indisponible
    }
  }, [])

  useEffect(() => {
    if (open) loadErrors()
  }, [open, syncStatus.error, loadErrors])

  // Réessayer une seule saisie
  const retryOne = useCallback(async (entry: SyncQueueEntry) => {
    if (entry.id === undefined) return
    await offlineDb.syncQueue.update(entry.id, {
      status: 'pending',
      tentatives: 0,
    })
    await loadErrors()
  }, [loadErrors])

  // Réessayer toutes les erreurs
  const retryAll = useCallback(async () => {
    const errorIds = errorEntries
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined)
    for (const id of errorIds) {
      await offlineDb.syncQueue.update(id, {
        status: 'pending',
        tentatives: 0,
      })
    }
    await loadErrors()
  }, [errorEntries, loadErrors])

  // Purger les archives
  const handlePurge = useCallback(async () => {
    setIsPurging(true)
    try {
      const { purgeOldArchives } = await import('@/lib/offline/sync-service')
      await purgeOldArchives()
    } finally {
      setIsPurging(false)
      setShowPurgeConfirm(false)
    }
  }, [])

  if (!open) return null

  const isBusy = isProcessing || isAuditing

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 90 }}
        onClick={onClose}
      />

      {/* Panneau — slide depuis le haut */}
      <div
        className="fixed left-0 right-0 top-0 overflow-y-auto"
        style={{
          maxHeight: '80vh',
          backgroundColor: '#fff',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          zIndex: 91,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header du panneau */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <span className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            Synchronisation
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ backgroundColor: '#F3F4F6', fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-5">
          {/* Section 1 — Compteurs */}
          <Section title="État de la file">
            <div className="flex flex-col gap-1.5">
              <CounterRow label="En attente" value={syncStatus.pending} />
              <CounterRow label="En cours d'envoi" value={syncStatus.syncing} />
              <CounterRow label="Synchronisées" value={syncStatus.synced} />
              <CounterRow
                label="Erreurs"
                value={syncStatus.error}
                highlight={syncStatus.error > 0}
              />
              <div
                className="pt-1.5 mt-1.5 flex justify-between text-sm font-medium"
                style={{ borderTop: '1px solid #E5E7EB', color: '#2C3E2D' }}
              >
                <span>Total dans la file</span>
                <span>{syncStatus.total}</span>
              </div>
            </div>
          </Section>

          {/* Section 2 — Actions */}
          <Section title="Actions">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => forceSync()}
                disabled={!isOnline || isBusy}
                className="w-full text-white font-medium text-sm disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 10,
                  minHeight: 44,
                  border: 'none',
                }}
              >
                {isBusy ? '⏳ En cours...' : '🔄 Forcer la synchronisation'}
              </button>
              <button
                type="button"
                onClick={() => forceSync()}
                disabled={!isOnline || isBusy}
                className="w-full font-medium text-sm disabled:opacity-50"
                style={{
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: 10,
                  minHeight: 44,
                  border: 'none',
                }}
              >
                🔍 Tout vérifier
              </button>
            </div>
          </Section>

          {/* Section 3 — Dernier audit */}
          {lastAuditResult && (
            <Section title="Dernier audit">
              <AuditResultDisplay result={lastAuditResult} />
            </Section>
          )}

          {/* Section 4 — Stockage */}
          {storageEstimate && (
            <Section title="Stockage">
              <div className="flex flex-col gap-2">
                {/* Barre de progression */}
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 8, backgroundColor: '#E5E7EB' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(storageEstimate.usagePercent, 100)}%`,
                      backgroundColor:
                        storageEstimate.usagePercent > 80
                          ? '#F59E0B'
                          : 'var(--color-primary)',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  {storageEstimate.usageFormatted} / {storageEstimate.quotaFormatted} utilisés (
                  {storageEstimate.usagePercent}%)
                </p>
                {storageEstimate.usagePercent > 80 && (
                  <p className="text-xs" style={{ color: '#D97706' }}>
                    ⚠️ Espace limité — les archives seront purgées automatiquement
                  </p>
                )}
                {/* Bouton purge */}
                {!showPurgeConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowPurgeConfirm(true)}
                    className="w-full text-sm font-medium"
                    style={{
                      backgroundColor: '#FEF2F2',
                      color: '#991B1B',
                      borderRadius: 10,
                      minHeight: 40,
                      border: 'none',
                    }}
                  >
                    🗑️ Purger les archives
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePurge}
                      disabled={isPurging}
                      className="flex-1 text-sm font-medium text-white disabled:opacity-50"
                      style={{
                        backgroundColor: '#DC2626',
                        borderRadius: 10,
                        minHeight: 40,
                        border: 'none',
                      }}
                    >
                      {isPurging ? '...' : 'Confirmer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPurgeConfirm(false)}
                      className="flex-1 text-sm font-medium"
                      style={{
                        backgroundColor: '#F3F4F6',
                        color: '#374151',
                        borderRadius: 10,
                        minHeight: 40,
                        border: 'none',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Section 5 — Erreurs détaillées */}
          {syncStatus.error > 0 && (
            <Section title="Erreurs">
              <div className="flex flex-col gap-2">
                {errorEntries.map((entry) => (
                  <div
                    key={entry.uuid_client}
                    className="flex flex-col gap-1 p-3 rounded-lg"
                    style={{ backgroundColor: '#FEF2F2' }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium" style={{ color: '#991B1B' }}>
                          {TABLE_LABELS[entry.table_cible] ?? entry.table_cible}
                        </span>
                        <span className="text-xs" style={{ color: '#6B7280' }}>
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => retryOne(entry)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: '#fff',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-primary)',
                        }}
                      >
                        Réessayer
                      </button>
                    </div>
                    {entry.derniere_erreur && (
                      <p className="text-xs" style={{ color: '#DC2626' }}>
                        {entry.derniere_erreur}
                      </p>
                    )}
                  </div>
                ))}
                {errorEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={retryAll}
                    className="w-full text-sm font-medium"
                    style={{
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      borderRadius: 10,
                      minHeight: 40,
                      border: 'none',
                    }}
                  >
                    🔄 Réessayer tout ({errorEntries.length})
                  </button>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

// --- Composants internes ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: '#9CA3AF' }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function CounterRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between text-sm" style={{ color: highlight ? '#DC2626' : '#374151' }}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function AuditResultDisplay({
  result,
}: {
  result: { totalChecked: number; missing: number; errors: number }
}) {
  if (result.errors > 0) {
    return (
      <p className="text-sm" style={{ color: '#DC2626' }}>
        ❌ {result.errors} erreur{result.errors > 1 ? 's' : ''} pendant la vérification
      </p>
    )
  }
  if (result.missing > 0) {
    return (
      <p className="text-sm" style={{ color: '#D97706' }}>
        ⚠️ {result.missing} saisie{result.missing > 1 ? 's' : ''} n&apos;étai
        {result.missing > 1 ? 'ent' : 't'} pas sur le serveur — renvoyée
        {result.missing > 1 ? 's' : ''} automatiquement
      </p>
    )
  }
  return (
    <p className="text-sm" style={{ color: '#166534' }}>
      ✅ {result.totalChecked} saisie{result.totalChecked > 1 ? 's' : ''} vérifiée
      {result.totalChecked > 1 ? 's' : ''} — tout est en ordre
    </p>
  )
}

/** Formate un ISO timestamp en date lisible FR */
function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}
