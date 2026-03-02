/**
 * Calcul des taux de perte pour les semis.
 * Formules définies dans context.md §5.2.
 * Toutes ces fonctions sont pures : elles ne modifient aucun état.
 */

import type { Seedling } from '@/lib/types'

// ---- Types de retour ----

export type MiniMotteLossStats = {
  /** Nombre de mottes au départ */
  total_depart: number
  /** Plants morts avant plantation */
  mortes: number
  /** Plants donnés (pas morts, pas plantés) */
  donnees: number
  /** Plants effectivement plantés */
  plantes: number
  /** Taux de perte global en % (null si données manquantes) */
  perte_pct: number | null
}

export type CaissetteGodetLossStats = {
  /** Nombre de plants en caissette au départ */
  total_depart: number
  /** Plants morts en caissette */
  mortes_caissette: number
  /** Plants morts en godet */
  mortes_godet: number
  /** Plants donnés (pas morts, pas plantés) */
  donnees: number
  /** Plants effectivement plantés */
  plantes: number
  /** Taux de perte étape caissette en % (null si données manquantes) */
  perte_caissette_pct: number | null
  /** Taux de perte étape godet en % (null si données manquantes) */
  perte_godet_pct: number | null
  /** Taux de perte global en % (null si données manquantes) */
  perte_globale_pct: number | null
}

export type SeedlingLossStats = MiniMotteLossStats | CaissetteGodetLossStats

// ---- Fonctions de calcul ----

/**
 * Calcule les statistiques de perte pour un semis en mini-mottes.
 * Perte globale = 1 - (nb_plants_obtenus / nb_mottes)
 * Ex: 98 mottes → 75 plantées (20 mortes + 3 données) = 23% perte
 */
export function computeMiniMotteLossRate(seedling: Seedling): MiniMotteLossStats {
  const total_depart = seedling.nb_mottes ?? 0
  const mortes = seedling.nb_mortes_mottes ?? 0
  const donnees = seedling.nb_donnees ?? 0
  const plantes = seedling.nb_plants_obtenus ?? 0

  // Perte null si l'une des deux valeurs déterminantes est manquante
  const perte_pct =
    seedling.nb_mottes != null && seedling.nb_plants_obtenus != null && seedling.nb_mottes > 0
      ? Math.round((1 - seedling.nb_plants_obtenus / seedling.nb_mottes) * 10000) / 100
      : null

  return { total_depart, mortes, donnees, plantes, perte_pct }
}

/**
 * Calcule les statistiques de perte pour un semis en caissette/godet.
 * - Perte étape caissette = nb_mortes_caissette / nb_plants_caissette
 * - Perte étape godet = (nb_mortes_godet + nb_donnees) / nb_godets
 * - Perte globale = 1 - (nb_plants_obtenus / nb_plants_caissette)
 * Ex: 50 caissette → 45 godets (5 mortes) → 35 plantées (5 mortes + 5 données) = 30% perte
 */
export function computeCaissetteGodetLossRate(seedling: Seedling): CaissetteGodetLossStats {
  const total_depart = seedling.nb_plants_caissette ?? 0
  const mortes_caissette = seedling.nb_mortes_caissette ?? 0
  const mortes_godet = seedling.nb_mortes_godet ?? 0
  const donnees = seedling.nb_donnees ?? 0
  const plantes = seedling.nb_plants_obtenus ?? 0

  const perte_caissette_pct =
    seedling.nb_plants_caissette != null &&
    seedling.nb_mortes_caissette != null &&
    seedling.nb_plants_caissette > 0
      ? Math.round((seedling.nb_mortes_caissette / seedling.nb_plants_caissette) * 10000) / 100
      : null

  const perte_godet_pct =
    seedling.nb_godets != null &&
    seedling.nb_mortes_godet != null &&
    seedling.nb_godets > 0
      ? Math.round(
          ((seedling.nb_mortes_godet + donnees) / seedling.nb_godets) * 10000,
        ) / 100
      : null

  const perte_globale_pct =
    seedling.nb_plants_caissette != null &&
    seedling.nb_plants_obtenus != null &&
    seedling.nb_plants_caissette > 0
      ? Math.round(
          (1 - seedling.nb_plants_obtenus / seedling.nb_plants_caissette) * 10000,
        ) / 100
      : null

  return {
    total_depart,
    mortes_caissette,
    mortes_godet,
    donnees,
    plantes,
    perte_caissette_pct,
    perte_godet_pct,
    perte_globale_pct,
  }
}

/**
 * Dispatcher : appelle la bonne fonction selon le processus du semis.
 */
export function computeSeedlingLossRate(seedling: Seedling): SeedlingLossStats {
  if (seedling.processus === 'mini_motte') {
    return computeMiniMotteLossRate(seedling)
  }
  return computeCaissetteGodetLossRate(seedling)
}
