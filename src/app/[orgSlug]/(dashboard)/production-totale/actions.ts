'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'

/* ─── Types ─── */

export interface ProductionSummaryRow {
  variety_id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  annee: number
  mois: number | null
  // Volumes (grammes)
  total_cueilli_g: number
  total_tronconnee_g: number
  total_sechee_g: number
  total_triee_g: number
  total_utilise_production_g: number
  total_vendu_direct_g: number
  total_achete_g: number
  // Temps (minutes)
  temps_cueillette_min: number
  temps_tronconnage_min: number
  temps_sechage_min: number
  temps_triage_min: number
  temps_production_min: number
  // Calculé
  temps_total_min: number
}

export type ForecastMap = Record<string, number>

/* ─── Requêtes ─── */

/**
 * Récupère les cumuls de production depuis production_summary.
 * Si mois est null → lignes annuelles (mois IS NULL).
 * Si mois est renseigné → filtre par mois.
 * Jointure avec varieties pour nom, famille.
 */
export async function fetchProductionSummary(
  annee: number,
  mois?: number | null,
): Promise<ProductionSummaryRow[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  let query = supabase
    .from('production_summary')
    .select('*')
    .eq('farm_id', farmId)
    .eq('annee', annee)

  if (mois != null) {
    query = query.eq('mois', mois)
  } else {
    query = query.is('mois', null)
  }

  const { data, error } = await query

  if (error) throw new Error(`Erreur production_summary : ${error.message}`)
  if (!data || data.length === 0) return []

  // Récupérer les variétés
  const varietyIds = [...new Set(data.map(d => d.variety_id))]
  const { data: varieties, error: vErr } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille')
    .in('id', varietyIds)

  if (vErr) throw new Error(`Erreur variétés : ${vErr.message}`)

  const varietyMap = new Map(
    (varieties ?? []).map(v => [v.id, v]),
  )

  const rows: ProductionSummaryRow[] = data.map(row => {
    const v = varietyMap.get(row.variety_id)
    const tempsCueillette = Number(row.temps_cueillette_min) || 0
    const tempsTronconnage = Number(row.temps_tronconnage_min) || 0
    const tempsSechage = Number(row.temps_sechage_min) || 0
    const tempsTriage = Number(row.temps_triage_min) || 0
    const tempsProduction = Number(row.temps_production_min) || 0

    return {
      variety_id: row.variety_id,
      nom_vernaculaire: v?.nom_vernaculaire ?? 'Inconnue',
      nom_latin: v?.nom_latin ?? null,
      famille: v?.famille ?? null,
      annee: row.annee,
      mois: row.mois,
      total_cueilli_g: Number(row.total_cueilli_g) || 0,
      total_tronconnee_g: Number(row.total_tronconnee_g) || 0,
      total_sechee_g: Number(row.total_sechee_g) || 0,
      total_triee_g: Number(row.total_triee_g) || 0,
      total_utilise_production_g: Number(row.total_utilise_production_g) || 0,
      total_vendu_direct_g: Number(row.total_vendu_direct_g) || 0,
      total_achete_g: Number(row.total_achete_g) || 0,
      temps_cueillette_min: tempsCueillette,
      temps_tronconnage_min: tempsTronconnage,
      temps_sechage_min: tempsSechage,
      temps_triage_min: tempsTriage,
      temps_production_min: tempsProduction,
      temps_total_min: tempsCueillette + tempsTronconnage + tempsSechage + tempsTriage + tempsProduction,
    }
  })

  // Tri : famille → nom_vernaculaire
  rows.sort((a, b) => {
    const fa = a.famille ?? ''
    const fb = b.famille ?? ''
    if (fa !== fb) return fa.localeCompare(fb, 'fr')
    return a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr')
  })

  return rows
}

/**
 * Récupère les forecasts pour l'année (état 'frais' = objectifs de récolte).
 * Retourne une map variety_id → quantite_prevue_g.
 */
export async function fetchForecastsForProduction(annee: number): Promise<ForecastMap> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('forecasts')
    .select('variety_id, quantite_prevue_g, etat_plante')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .eq('etat_plante', 'frais')

  if (error) throw new Error(`Erreur forecasts : ${error.message}`)

  const map: ForecastMap = {}
  for (const row of data ?? []) {
    map[row.variety_id] = (map[row.variety_id] ?? 0) + Number(row.quantite_prevue_g)
  }

  return map
}

/**
 * Retourne les années distinctes dans production_summary pour cette ferme,
 * plus l'année en cours si absente.
 */
export async function fetchAvailableYears(): Promise<number[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('production_summary')
    .select('annee')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur années : ${error.message}`)

  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>((data ?? []).map(d => d.annee))
  yearsSet.add(currentYear)

  return Array.from(yearsSet).sort((a, b) => a - b)
}
