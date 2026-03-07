import type { TransformationType } from '@/lib/types'

/** Labels FR pour les etats plante — badges et selecteurs */
export const ETAT_PLANTE_LABELS: Record<string, string> = {
  frais: 'Frais',
  tronconnee: 'Tronconnee',
  sechee: 'Sechee',
  tronconnee_sechee: 'Tronc. sechee',
  sechee_triee: 'Sechee triee',
  tronconnee_sechee_triee: 'Tronc. sechee triee',
}

/** Configuration par module — passee en props aux composants partages */
export type TransformationModuleConfig = {
  module: 'tronconnage' | 'sechage' | 'triage'
  titre: string
  titreSingulier: string
  etatsEntree: string[] | null
  etatsSortie: string[] | null
  etatEntreeImplicite?: string
  etatSortieImplicite?: string
}

export const TRONCONNAGE_CONFIG: TransformationModuleConfig = {
  module: 'tronconnage',
  titre: 'Tronconnage',
  titreSingulier: 'tronconnage',
  etatsEntree: null,
  etatsSortie: null,
  etatEntreeImplicite: 'frais',
  etatSortieImplicite: 'tronconnee',
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
  varieties: { id: string; nom_vernaculaire: string; nom_latin: string | null }
}

/** Actions passees en props au composant client */
export type TransformationActions = {
  create: (fd: FormData) => Promise<import('@/lib/types').ActionResult>
  update: (id: string, fd: FormData) => Promise<import('@/lib/types').ActionResult>
  delete: (id: string) => Promise<import('@/lib/types').ActionResult>
}
