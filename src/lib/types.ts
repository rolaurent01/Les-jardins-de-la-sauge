/**
 * Types métier de l'application LJS.
 * Ces types reflètent le schéma Supabase défini dans 001_initial_schema.sql.
 */

export type TypeCycle = 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace'

export type Variety = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  type_cycle: TypeCycle | null
  duree_peremption_mois: number
  seuil_alerte_g: number | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** Résultat uniforme des Server Actions */
export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { error: string }
