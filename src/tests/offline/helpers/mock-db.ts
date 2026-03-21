/**
 * Helper de test : initialise fake-indexeddb pour Dexie.
 * Importé avant chaque suite de tests offline.
 */
import 'fake-indexeddb/auto'
import { offlineDb } from '@/lib/offline/db'

/**
 * Réinitialise la base Dexie entre chaque test.
 * Supprime toutes les données de tous les stores.
 */
export async function resetDatabase(): Promise<void> {
  await offlineDb.syncQueue.clear()
  await offlineDb.context.clear()
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

export { offlineDb }
