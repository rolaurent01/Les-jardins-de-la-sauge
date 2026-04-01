/**
 * Calcul des taux de perte pour les boutures.
 * Toutes ces fonctions sont pures : elles ne modifient aucun état.
 */

import type { Bouture } from '@/lib/types'

// ---- Types de retour ----

export type PlaqueLossStats = {
  /** Nombre total de boutures au départ (plaques × trous) */
  total_depart: number
  /** Plants morts en plaque */
  mortes_plaque: number
  /** Plants morts en godet */
  mortes_godet: number
  /** Plants donnés */
  donnees: number
  /** Plants effectivement obtenus */
  plantes: number
  /** Taux de perte étape plaque en % (null si données manquantes) */
  perte_plaque_pct: number | null
  /** Taux de perte étape godet en % (null si données manquantes) */
  perte_godet_pct: number | null
  /** Taux de perte global en % (null si données manquantes) */
  perte_globale_pct: number | null
}

export type GodetDirectLossStats = {
  /** Nombre de godets au départ */
  total_depart: number
  /** Plants morts en godet */
  mortes_godet: number
  /** Plants donnés */
  donnees: number
  /** Plants effectivement obtenus */
  plantes: number
  /** Taux de perte global en % (null si données manquantes) */
  perte_pct: number | null
}

export type CuttingLossStats = PlaqueLossStats | GodetDirectLossStats

// ---- Fonctions de calcul ----

/**
 * Calcule les statistiques de perte pour une bouture passée par plaque alvéolée.
 * Perte plaque = nb_mortes_plaque / (nb_plaques × nb_trous_par_plaque)
 * Perte godet = (nb_mortes_godet + nb_donnees) / nb_godets
 * Perte globale = 1 - nb_plants_obtenus / (nb_plaques × nb_trous_par_plaque)
 */
export function computePlaqueLossRate(cutting: Bouture): PlaqueLossStats {
  const totalPlaques = (cutting.nb_plaques ?? 0) * (cutting.nb_trous_par_plaque ?? 0)
  const mortes_plaque = cutting.nb_mortes_plaque ?? 0
  const mortes_godet = cutting.nb_mortes_godet ?? 0
  const donnees = cutting.nb_donnees ?? 0
  const plantes = cutting.nb_plants_obtenus ?? 0

  const perte_plaque_pct =
    cutting.nb_plaques != null &&
    cutting.nb_trous_par_plaque != null &&
    cutting.nb_mortes_plaque != null &&
    totalPlaques > 0
      ? Math.round((cutting.nb_mortes_plaque / totalPlaques) * 10000) / 100
      : null

  const perte_godet_pct =
    cutting.nb_godets != null &&
    cutting.nb_mortes_godet != null &&
    cutting.nb_godets > 0
      ? Math.round(((cutting.nb_mortes_godet + donnees) / cutting.nb_godets) * 10000) / 100
      : null

  const perte_globale_pct =
    cutting.nb_plants_obtenus != null && totalPlaques > 0
      ? Math.round((1 - cutting.nb_plants_obtenus / totalPlaques) * 10000) / 100
      : null

  return {
    total_depart: totalPlaques,
    mortes_plaque,
    mortes_godet,
    donnees,
    plantes,
    perte_plaque_pct,
    perte_godet_pct,
    perte_globale_pct,
  }
}

/**
 * Calcule les statistiques de perte pour une bouture mise directement en godet.
 * Perte globale = 1 - nb_plants_obtenus / nb_godets
 */
export function computeGodetDirectLossRate(cutting: Bouture): GodetDirectLossStats {
  const total_depart = cutting.nb_godets ?? 0
  const mortes_godet = cutting.nb_mortes_godet ?? 0
  const donnees = cutting.nb_donnees ?? 0
  const plantes = cutting.nb_plants_obtenus ?? 0

  const perte_pct =
    cutting.nb_godets != null &&
    cutting.nb_plants_obtenus != null &&
    cutting.nb_godets > 0
      ? Math.round((1 - cutting.nb_plants_obtenus / cutting.nb_godets) * 10000) / 100
      : null

  return { total_depart, mortes_godet, donnees, plantes, perte_pct }
}

/**
 * Dispatcher : appelle la bonne fonction selon le flux de la bouture.
 * Si nb_plaques est renseigné → flux plaque, sinon → flux godet direct.
 */
export function computeCuttingLossRate(cutting: Bouture): CuttingLossStats {
  if (cutting.nb_plaques != null) {
    return computePlaqueLossRate(cutting)
  }
  return computeGodetDirectLossRate(cutting)
}
