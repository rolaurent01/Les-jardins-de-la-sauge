/**
 * Logique de recalcul du statut d'une bouture (cutting).
 * Le statut est recalculé en logique applicative (pas en trigger SQL).
 */

import type { CuttingStatut } from '@/lib/types'

/** Données nécessaires pour calculer le statut d'un cutting */
type CuttingForStatut = {
  nb_plaques: number | null
  date_rempotage: string | null
  nb_plants_obtenus: number | null
}

/**
 * Calcule le statut d'une bouture à partir de ses champs et du nombre de plants plantés.
 *
 * @param cutting — les champs de la bouture
 * @param plantsPlantes — SUM(plantings.nb_plants) pour les plantings actifs et non-supprimés
 */
export function computeCuttingStatut(
  cutting: CuttingForStatut,
  plantsPlantes: number,
): CuttingStatut {
  const { nb_plaques, date_rempotage, nb_plants_obtenus } = cutting

  // Si des plants ont été obtenus, vérifier l'état de plantation
  if (nb_plants_obtenus != null && nb_plants_obtenus > 0) {
    const restants = nb_plants_obtenus - plantsPlantes
    if (restants <= 0) return 'epuise'
    if (plantsPlantes > 0) return 'en_plantation'
    return 'pret'
  }

  // Pas encore de plants obtenus — progression dans le cycle
  // Repiquage = passage plaque → godet (uniquement si plaque utilisée)
  if (nb_plaques != null && date_rempotage) return 'repiquage'

  return 'bouture'
}

/**
 * Calcule le nombre de plants restants (disponibles) pour une bouture.
 * Retourne null si nb_plants_obtenus n'est pas renseigné.
 */
export function computeCuttingPlantsRestants(
  nbPlantsObtenus: number | null,
  plantsPlantes: number,
): number | null {
  if (nbPlantsObtenus == null) return null
  return Math.max(0, nbPlantsObtenus - plantsPlantes)
}
