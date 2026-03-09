import type { ProductionMode } from '@/lib/types'

/** Labels FR pour les modes de production */
export const MODE_LABELS: Record<ProductionMode, string> = {
  produit: 'Produit',
  melange: 'Mélange',
}

/** Descriptions des modes de production — affichées dans le wizard */
export const MODE_DESCRIPTIONS: Record<ProductionMode, string> = {
  produit: 'Partir du nombre de sachets/pots — les poids sont calculés depuis les pourcentages',
  melange: 'Partir des poids réels — le conditionnement est fait plus tard',
}
