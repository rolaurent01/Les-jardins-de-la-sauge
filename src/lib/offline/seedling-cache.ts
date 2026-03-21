import { offlineDb, type CachedSeedling } from './db'
import { computeSeedlingStatut, computePlantsRestants } from '@/lib/utils/seedling-statut'
import type { Processus } from '@/lib/types'

/**
 * Met à jour le cache IndexedDB d'un seedling de façon optimiste.
 * Merge les champs fournis, recalcule statut et plants_restants localement.
 * Appelé AVANT l'ajout à la sync queue pour un retour visuel immédiat.
 *
 * @throws si le seedling n'existe pas dans le cache
 */
export async function updateCachedSeedlingOptimistic(
  seedlingId: string,
  fields: {
    date_levee?: string | null
    date_repiquage?: string | null
    nb_plants_obtenus?: number | null
    nb_mortes_mottes?: number
    nb_mortes_caissette?: number
    nb_mortes_godet?: number
    nb_donnees?: number
    temps_repiquage_min?: number | null
    commentaire?: string | null
  },
): Promise<CachedSeedling> {
  const existing = await offlineDb.seedlings.get(seedlingId)
  if (!existing) throw new Error(`Seedling ${seedlingId} introuvable dans le cache`)

  // Merge des champs non-undefined
  const merged = { ...existing }

  if (fields.nb_plants_obtenus !== undefined) {
    merged.nb_plants_obtenus = fields.nb_plants_obtenus
  }

  // Recalculer statut et plants_restants avec les données mergées
  const newStatut = computeSeedlingStatut(
    {
      processus: merged.processus as Processus,
      date_levee: fields.date_levee !== undefined ? fields.date_levee : null,
      date_repiquage: fields.date_repiquage !== undefined ? fields.date_repiquage : null,
      nb_plants_obtenus: merged.nb_plants_obtenus,
    },
    merged.plants_plantes,
  )

  merged.statut = newStatut
  merged.plants_restants = computePlantsRestants(
    merged.nb_plants_obtenus,
    merged.plants_plantes,
  )

  // Écrire dans IndexedDB (déclenche useLiveQuery automatiquement)
  await offlineDb.seedlings.put(merged)

  return merged
}
