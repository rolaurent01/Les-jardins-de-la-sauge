import { offlineDb, type ReferenceDataResponse } from './db'
import { getOfflineContext, updateLastSyncedAt } from './context-offline'

/**
 * Charge TOUTES les données de référence pour la ferme active.
 * Appelé au lancement de l'app (online) et après un switch de ferme.
 *
 * 1. Appelle la route API qui retourne toutes les données filtrées
 * 2. Vide les stores IndexedDB (sauf syncQueue !)
 * 3. Remplit avec les nouvelles données
 * 4. Met à jour le timestamp lastSyncedAt
 */
export async function loadReferenceData(farmId: string): Promise<void> {
  const response = await fetch(`/api/offline/reference-data?farmId=${encodeURIComponent(farmId)}`, {
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Erreur chargement cache offline : ${response.status} — ${text}`)
  }

  const data: ReferenceDataResponse = await response.json()

  // Vider les stores de référence (PAS syncQueue, PAS context)
  await clearReferenceCache()

  // Remplir avec les nouvelles données en une transaction
  await offlineDb.transaction(
    'rw',
    [
      offlineDb.varieties,
      offlineDb.sites,
      offlineDb.parcels,
      offlineDb.rows,
      offlineDb.plantings,
      offlineDb.recipes,
      offlineDb.seedLots,
      offlineDb.seedlings,
      offlineDb.externalMaterials,
    ],
    async () => {
      await offlineDb.varieties.bulkAdd(data.varieties)
      await offlineDb.sites.bulkAdd(data.sites)
      await offlineDb.parcels.bulkAdd(data.parcels)
      await offlineDb.rows.bulkAdd(data.rows)
      if (data.plantings) await offlineDb.plantings.bulkAdd(data.plantings)
      await offlineDb.recipes.bulkAdd(data.recipes)
      await offlineDb.seedLots.bulkAdd(data.seedLots)
      if (data.seedlings) await offlineDb.seedlings.bulkAdd(data.seedlings)
      await offlineDb.externalMaterials.bulkAdd(data.externalMaterials)
    }
  )

  // Mettre à jour le timestamp de synchronisation
  await updateLastSyncedAt(data.timestamp)
}

/**
 * Vérifie si le cache est valide (même ferme et contexte existant).
 * Retourne false si farmId différent ou si aucun contexte n'existe.
 */
export async function isCacheValid(currentFarmId: string): Promise<boolean> {
  const ctx = await getOfflineContext()
  if (!ctx) return false
  return ctx.farmId === currentFarmId && ctx.lastSyncedAt !== null
}

/**
 * Vide tout le cache de référence.
 * NE vide PAS syncQueue (les saisies pending doivent survivre au switch de ferme).
 * NE vide PAS context (sera écrasé par le nouveau).
 */
export async function clearReferenceCache(): Promise<void> {
  await offlineDb.transaction(
    'rw',
    [
      offlineDb.varieties,
      offlineDb.sites,
      offlineDb.parcels,
      offlineDb.rows,
      offlineDb.plantings,
      offlineDb.recipes,
      offlineDb.seedLots,
      offlineDb.seedlings,
      offlineDb.externalMaterials,
    ],
    async () => {
      await offlineDb.varieties.clear()
      await offlineDb.sites.clear()
      await offlineDb.parcels.clear()
      await offlineDb.rows.clear()
      await offlineDb.plantings.clear()
      await offlineDb.recipes.clear()
      await offlineDb.seedLots.clear()
      await offlineDb.seedlings.clear()
      await offlineDb.externalMaterials.clear()
    }
  )
}
