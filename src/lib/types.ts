/**
 * Types métier de l'application LJS.
 * Ces types reflètent le schéma Supabase défini dans les migrations SQL.
 */

export type TypeCycle = 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace'

/** Parties récoltables d'une plante — synchronisé avec la migration 004 */
export type PartiePlante =
  | 'feuille'
  | 'fleur'
  | 'graine'
  | 'racine'
  | 'fruit'
  | 'plante_entiere'

export const PARTIES_PLANTE: PartiePlante[] = [
  'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere',
]

export const PARTIE_PLANTE_LABELS: Record<PartiePlante, string> = {
  feuille:        'Feuille',
  fleur:          'Fleur',
  graine:         'Graine',
  racine:         'Racine',
  fruit:          'Fruit',
  plante_entiere: 'Plante entière',
}

export type Variety = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  type_cycle: TypeCycle | null
  duree_peremption_mois: number
  parties_utilisees: PartiePlante[]
  seuil_alerte_g: number | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ---- Référentiel géographique ----

export type Site = {
  id: string
  nom: string
  description: string | null
  deleted_at: string | null
  created_at: string
}

export type Parcel = {
  id: string
  site_id: string | null
  nom: string
  code: string
  orientation: string | null
  description: string | null
  deleted_at: string | null
  created_at: string
}

/** Parcelle avec son site en jointure */
export type ParcelWithSite = Parcel & {
  sites: Pick<Site, 'id' | 'nom'> | null
}

export type Row = {
  id: string
  parcel_id: string | null
  numero: string
  ancien_numero: string | null
  longueur_m: number | null
  position_ordre: number | null
  notes: string | null
  deleted_at: string | null
  created_at: string
}

/** Rang avec sa parcelle (et son site) en jointure */
export type RowWithParcel = Row & {
  parcels:
    | (Pick<Parcel, 'id' | 'nom' | 'code'> & {
        sites: Pick<Site, 'id' | 'nom'> | null
      })
    | null
}

// ---- Matières premières externes ----

/** Matière première non-plante (sel, sucre, huile essentielle achetée…) */
export type ExternalMaterial = {
  id: string
  nom: string
  unite: string
  notes: string | null
  deleted_at: string | null
  created_at: string
}

/**
 * Résultat uniforme des Server Actions.
 * T = unknown par défaut : ActionResult<Site> est assignable à ActionResult
 * sans perdre la sûreté de type (contrairement à `any`).
 */
export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { error: string }
