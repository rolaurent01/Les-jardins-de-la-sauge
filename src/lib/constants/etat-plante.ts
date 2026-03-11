/**
 * Constantes partagées pour les états de plante (etat_plante).
 * Utilisées dans les modules Transformation, Stock, Prévisionnel, etc.
 */

export const ETATS_PLANTE = [
  'frais', 'tronconnee', 'sechee',
  'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee',
] as const

export type EtatPlanteValue = (typeof ETATS_PLANTE)[number]

/** Labels FR pour affichage (badges, selects) */
export const ETAT_PLANTE_LABELS: Record<string, string> = {
  frais: 'Frais',
  tronconnee: 'Tronçonnée',
  sechee: 'Séchée',
  tronconnee_sechee: 'Tronç. séchée',
  sechee_triee: 'Séch. triée',
  tronconnee_sechee_triee: 'Tronç. séch. triée',
}

/** Couleurs associées aux états (badges, légendes) */
export const ETAT_PLANTE_COLORS: Record<string, string> = {
  frais: '#22C55E',
  tronconnee: '#F59E0B',
  sechee: '#3B82F6',
  tronconnee_sechee: '#8B5CF6',
  sechee_triee: '#EC4899',
  tronconnee_sechee_triee: '#6366F1',
}
