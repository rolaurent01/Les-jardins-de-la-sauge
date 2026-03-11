/**
 * Logique de recalcul du statut d'un semis (seedling).
 * Le statut est recalculé en logique applicative (pas en trigger SQL).
 */

import type { SeedlingStatut, Processus } from '@/lib/types'

/** Données nécessaires pour calculer le statut d'un seedling */
type SeedlingForStatut = {
  processus: Processus
  date_levee: string | null
  date_repiquage: string | null
  nb_plants_obtenus: number | null
}

/**
 * Calcule le statut d'un seedling à partir de ses champs et du nombre de plants plantés.
 *
 * @param seedling — les champs du seedling
 * @param plantsPlantes — SUM(plantings.nb_plants) pour les plantings actifs et non-supprimés
 */
export function computeSeedlingStatut(
  seedling: SeedlingForStatut,
  plantsPlantes: number,
): SeedlingStatut {
  const { processus, date_levee, date_repiquage, nb_plants_obtenus } = seedling

  // Si des plants ont été obtenus, vérifier l'état de plantation
  if (nb_plants_obtenus != null && nb_plants_obtenus > 0) {
    const restants = nb_plants_obtenus - plantsPlantes
    if (restants <= 0) return 'epuise'
    if (plantsPlantes > 0) return 'en_plantation'
    return 'pret'
  }

  // Pas encore de plants obtenus — progression dans le cycle
  if (processus === 'caissette_godet' && date_repiquage) return 'repiquage'
  if (date_levee) return 'leve'

  return 'semis'
}

/**
 * Calcule le nombre de plants restants (disponibles) pour un seedling.
 * Retourne null si nb_plants_obtenus n'est pas renseigné.
 */
export function computePlantsRestants(
  nbPlantsObtenus: number | null,
  plantsPlantes: number,
): number | null {
  if (nbPlantsObtenus == null) return null
  return Math.max(0, nbPlantsObtenus - plantsPlantes)
}
