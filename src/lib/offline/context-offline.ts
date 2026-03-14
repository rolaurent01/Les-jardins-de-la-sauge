import { offlineDb, type OfflineContext } from './db'

/**
 * Sauvegarde le contexte utilisateur dans IndexedDB.
 * Appelé après un login réussi ou un chargement de page online.
 * Upsert : écrase le contexte précédent (clé = 'current').
 */
export async function saveOfflineContext(ctx: {
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
  certifBio: boolean
}): Promise<void> {
  await offlineDb.context.put({
    key: 'current',
    userId: ctx.userId,
    farmId: ctx.farmId,
    organizationId: ctx.organizationId,
    orgSlug: ctx.orgSlug,
    certifBio: ctx.certifBio,
    lastSyncedAt: null, // sera mis à jour par le cache-loader
  })
}

/**
 * Lit le contexte offline sauvegardé (pour les formulaires en mode offline).
 * Retourne null si aucun contexte n'a été sauvegardé.
 */
export async function getOfflineContext(): Promise<OfflineContext | null> {
  const ctx = await offlineDb.context.get('current')
  return ctx ?? null
}

/**
 * Met à jour le timestamp de dernière synchronisation du cache.
 */
export async function updateLastSyncedAt(timestamp: string): Promise<void> {
  await offlineDb.context.update('current', { lastSyncedAt: timestamp })
}
