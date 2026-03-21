import type { TransformationType } from '@/lib/types'

/** Re-export des constantes partagées pour compatibilité */
export { ETAT_PLANTE_LABELS, ETAT_PLANTE_COLORS } from '@/lib/constants/etat-plante'

/** Configuration par module — passee en props aux composants partages */
export type TransformationModuleConfig = {
  module: 'tronconnage' | 'sechage' | 'triage'
  titre: string
  titreSingulier: string
  etatsEntree: string[] | null
  etatsSortie: string[] | null
  etatEntreeImplicite?: string
  etatSortieImplicite?: string
  /** Mode combine : entree + sortie en un seul formulaire (tronconnage, triage) */
  combined?: boolean
}

export const TRONCONNAGE_CONFIG: TransformationModuleConfig = {
  module: 'tronconnage',
  titre: 'Tronconnage',
  titreSingulier: 'tronconnage',
  etatsEntree: null,
  etatsSortie: null,
  etatEntreeImplicite: 'frais',
  etatSortieImplicite: 'tronconnee',
  combined: true,
}

export const SECHAGE_CONFIG: TransformationModuleConfig = {
  module: 'sechage',
  titre: 'Sechage',
  titreSingulier: 'sechage',
  etatsEntree: ['frais', 'tronconnee'],
  etatsSortie: ['sechee', 'tronconnee_sechee'],
}

export const TRIAGE_CONFIG: TransformationModuleConfig = {
  module: 'triage',
  titre: 'Triage',
  titreSingulier: 'triage',
  etatsEntree: ['sechee', 'tronconnee_sechee'],
  etatsSortie: ['sechee_triee', 'tronconnee_sechee_triee'],
  combined: true,
}

/** Type unifie pour un item de transformation (couvre cutting, drying, sorting) */
export type TransformationItem = {
  id: string
  variety_id: string
  partie_plante: string
  type: TransformationType
  etat_plante?: string
  date: string
  poids_g: number
  temps_min: number | null
  commentaire: string | null
  paired_id?: string | null
  varieties: { id: string; nom_vernaculaire: string; nom_latin: string | null }
}

/** Actions passees en props au composant client */
export type TransformationActions = {
  create: (fd: FormData) => Promise<import('@/lib/types').ActionResult>
  update: (id: string, fd: FormData) => Promise<import('@/lib/types').ActionResult>
  delete: (id: string) => Promise<import('@/lib/types').ActionResult>
  /** Creation combinee entree + sortie (tronconnage, triage) */
  createCombined?: (fd: FormData) => Promise<import('@/lib/types').ActionResult>
  /** Suppression groupee (record + son paired) */
  deletePaired?: (id: string) => Promise<import('@/lib/types').ActionResult>
}
