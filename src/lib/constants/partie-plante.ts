/**
 * Constantes partagées pour les parties de plante (partie_plante).
 * Utilisées dans les formulaires mobile (cueillette, achat, vente, transformation).
 */

export const PARTIE_PLANTE_OPTIONS = [
  { value: 'feuille', label: 'Feuille' },
  { value: 'fleur', label: 'Fleur' },
  { value: 'graine', label: 'Graine' },
  { value: 'racine', label: 'Racine' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'plante_entiere', label: 'Plante entière' },
] satisfies { value: string; label: string }[]
