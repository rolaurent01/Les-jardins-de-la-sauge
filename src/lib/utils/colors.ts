import type { PartiePlante } from '@/lib/types'

/** Couleurs de badge pour les parties de plante — partage entre tous les modules */
export const PARTIE_COLORS: Record<PartiePlante, { bg: string; color: string }> = {
  feuille:        { bg: '#DCFCE7', color: '#166534' },
  fleur:          { bg: '#FCE7F3', color: '#9D174D' },
  graine:         { bg: '#FEF3C7', color: '#92400E' },
  racine:         { bg: '#E8DECF', color: '#78350F' },
  fruit:          { bg: '#FFEDD5', color: '#9A3412' },
  plante_entiere: { bg: '#F3F4F6', color: '#6B7280' },
}
