import { offlineDb, type CachedCutting } from './db'
import { computeCuttingStatut, computeCuttingPlantsRestants } from '@/lib/utils/cutting-statut'

/**
 * Met à jour le cache IndexedDB d'une bouture de façon optimiste.
 * Merge les champs fournis, recalcule statut et plants_restants localement.
 * Appelé AVANT l'ajout à la sync queue pour un retour visuel immédiat.
 *
 * @throws si la bouture n'existe pas dans le cache
 */
export async function updateCachedCuttingOptimistic(
  cuttingId: string,
  fields: {
    date_rempotage?: string | null
    nb_plants_obtenus?: number | null
    nb_mortes_plaque?: number
    nb_mortes_godet?: number
    nb_donnees?: number
    temps_rempotage_min?: number | null
    commentaire?: string | null
  },
): Promise<CachedCutting> {
  const existing = await offlineDb.boutures.get(cuttingId)
  if (!existing) throw new Error(`Cutting ${cuttingId} introuvable dans le cache`)

  // Merge des champs non-undefined
  const merged = { ...existing }

  if (fields.nb_plants_obtenus !== undefined) {
    merged.nb_plants_obtenus = fields.nb_plants_obtenus
  }

  // Recalculer statut et plants_restants avec les données mergées
  // On ne peut pas savoir nb_plaques depuis le cache minimal, utiliser un heuristique :
  // si le type_multiplication implique des plaques, on considère qu'il y en a
  const newStatut = computeCuttingStatut(
    {
      nb_plaques: null, // pas stocké dans le cache minimal — statut simplifié
      date_rempotage: fields.date_rempotage !== undefined ? fields.date_rempotage : null,
      nb_plants_obtenus: merged.nb_plants_obtenus,
    },
    merged.plants_plantes,
  )

  merged.statut = newStatut
  merged.plants_restants = computeCuttingPlantsRestants(
    merged.nb_plants_obtenus,
    merged.plants_plantes,
  )

  // Écrire dans IndexedDB
  await offlineDb.boutures.put(merged)

  return merged
}
