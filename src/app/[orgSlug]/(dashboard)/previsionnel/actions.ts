'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { forecastSchema } from '@/lib/validation/previsionnel'
import type { ActionResult, ForecastWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Types retour ----

export type RealisedData = {
  /** Total cueilli (g) par variety_id — source : harvests */
  cueilliParVariete: Record<string, number>
  /** Stock (g) par clé "variety_id:etat_plante" — source : v_stock */
  stockParVarieteEtat: Record<string, number>
}

// ---- Requêtes ----

/** Récupère tous les forecasts de la ferme courante pour une année donnée */
export async function fetchForecasts(annee: number): Promise<ForecastWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('forecasts')
    .select('*, varieties(id, nom_vernaculaire, nom_latin, famille)')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Erreur chargement prévisionnel : ${error.message}`)

  const rows = (data ?? []) as unknown as ForecastWithVariety[]

  // Tri : groupé par variété (famille → nom), puis par etat_plante
  const etatOrder: Record<string, number> = {
    frais: 0, tronconnee: 1, sechee: 2,
    tronconnee_sechee: 3, sechee_triee: 4, tronconnee_sechee_triee: 5,
  }
  rows.sort((a, b) => {
    const famA = a.varieties?.famille ?? 'zzz'
    const famB = b.varieties?.famille ?? 'zzz'
    if (famA !== famB) return famA.localeCompare(famB, 'fr')
    const nomA = a.varieties?.nom_vernaculaire ?? ''
    const nomB = b.varieties?.nom_vernaculaire ?? ''
    if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr')
    return (etatOrder[a.etat_plante ?? ''] ?? 99) - (etatOrder[b.etat_plante ?? ''] ?? 99)
  })

  return rows
}

/** Récupère les années distinctes qui ont des forecasts + année en cours */
export async function fetchForecastYears(): Promise<number[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('forecasts')
    .select('annee')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur chargement années : ${error.message}`)

  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>((data ?? []).map(d => d.annee))
  yearsSet.add(currentYear)

  return Array.from(yearsSet).sort((a, b) => a - b)
}

/** Récupère les variétés non masquées pour cette ferme (pour le select "Ajouter") */
export async function fetchVarietiesForForecast(): Promise<
  { id: string; nom_vernaculaire: string; nom_latin: string | null; famille: string | null }[]
> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('famille', { ascending: true })
    .order('nom_vernaculaire', { ascending: true })

  if (error) throw new Error(`Erreur chargement variétés : ${error.message}`)

  // Filtrer avec farm_variety_settings (masquées)
  const { data: settings } = await supabase
    .from('farm_variety_settings')
    .select('variety_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = new Set((settings ?? []).map(s => s.variety_id))

  return (data ?? []).filter(v => !hiddenIds.has(v.id))
}

/**
 * Récupère les données réalisées pour le prévisionnel :
 * - cueilliParVariete : total cueilli (g) par variété depuis harvests
 * - stockParVarieteEtat : stock actuel (g) par variété × état depuis v_stock
 */
export async function fetchRealisedData(annee: number): Promise<RealisedData> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const startDate = `${annee}-01-01`
  const endDate = `${annee}-12-31`

  // Requêtes en parallèle
  const [harvestsResult, stockResult] = await Promise.all([
    supabase
      .from('harvests')
      .select('variety_id, poids_g')
      .eq('farm_id', farmId)
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null),
    supabase
      .from('v_stock')
      .select('variety_id, etat_plante, stock_g')
      .eq('farm_id', farmId),
  ])

  if (harvestsResult.error) throw new Error(`Erreur chargement récoltes : ${harvestsResult.error.message}`)
  if (stockResult.error) throw new Error(`Erreur chargement stock : ${stockResult.error.message}`)

  // Agréger le cueilli par variété
  const cueilliParVariete: Record<string, number> = {}
  for (const h of harvestsResult.data ?? []) {
    cueilliParVariete[h.variety_id] = (cueilliParVariete[h.variety_id] ?? 0) + (h.poids_g ?? 0)
  }

  // Agréger le stock par variété × état
  const stockParVarieteEtat: Record<string, number> = {}
  for (const s of stockResult.data ?? []) {
    if (!s.etat_plante) continue
    const key = `${s.variety_id}:${s.etat_plante}`
    stockParVarieteEtat[key] = (stockParVarieteEtat[key] ?? 0) + (s.stock_g ?? 0)
  }

  return { cueilliParVariete, stockParVarieteEtat }
}

// ---- Actions ----

/** Crée ou met à jour un forecast (upsert sur contrainte unique) */
export async function upsertForecast(
  data: {
    variety_id: string
    annee: number
    quantite_prevue_g: number
    etat_plante: string
    partie_plante?: string | null
    commentaire?: string | null
  },
): Promise<ActionResult<{ id: string }>> {
  const parsed = forecastSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') }
  }

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: forecast, error } = await supabase
    .from('forecasts')
    .upsert(
      {
        farm_id: farmId,
        variety_id: parsed.data.variety_id,
        annee: parsed.data.annee,
        quantite_prevue_g: parsed.data.quantite_prevue_g,
        etat_plante: parsed.data.etat_plante,
        partie_plante: parsed.data.partie_plante ?? null,
        commentaire: parsed.data.commentaire ?? null,
        created_by: userId,
        updated_by: userId,
      } as never,
      { onConflict: 'farm_id,annee,variety_id,etat_plante,partie_plante' },
    )
    .select('id')
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/previsionnel'))
  return { success: true, data: { id: forecast.id } }
}

/** Supprime un forecast (hard delete) */
export async function deleteForecast(forecastId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('forecasts')
    .delete()
    .eq('id', forecastId)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/previsionnel'))
  return { success: true }
}

/** Copie les forecasts d'une année source vers une année cible (avec etat_plante) */
export async function copyForecastsFromYear(
  sourceYear: number,
  targetYear: number,
  overwrite: boolean = false,
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Vérifier si la cible a déjà des forecasts
  const { data: existing } = await supabase
    .from('forecasts')
    .select('id')
    .eq('farm_id', farmId)
    .eq('annee', targetYear)

  if ((existing ?? []).length > 0 && !overwrite) {
    return { error: `L'année ${targetYear} a déjà ${existing!.length} objectif(s). Utilisez l'option écraser.` }
  }

  // Si écraser → supprimer les forecasts existants de la cible
  if ((existing ?? []).length > 0 && overwrite) {
    const { error: delError } = await supabase
      .from('forecasts')
      .delete()
      .eq('farm_id', farmId)
      .eq('annee', targetYear)

    if (delError) return { error: `Erreur suppression existants : ${delError.message}` }
  }

  // Récupérer les forecasts source (avec etat_plante)
  const { data: sources, error: srcError } = await supabase
    .from('forecasts')
    .select('variety_id, etat_plante, partie_plante, quantite_prevue_g, commentaire')
    .eq('farm_id', farmId)
    .eq('annee', sourceYear)

  if (srcError) return { error: `Erreur lecture source : ${srcError.message}` }
  if (!sources || sources.length === 0) return { error: `Aucun objectif trouvé pour ${sourceYear}` }

  // Insérer les copies avec etat_plante
  const copies = sources.map(s => ({
    farm_id: farmId,
    annee: targetYear,
    variety_id: s.variety_id,
    etat_plante: s.etat_plante,
    partie_plante: s.partie_plante,
    quantite_prevue_g: s.quantite_prevue_g,
    commentaire: s.commentaire,
    created_by: userId,
    updated_by: userId,
  }))

  const { error: insError } = await supabase
    .from('forecasts')
    .insert(copies)

  if (insError) return { error: `Erreur copie : ${insError.message}` }

  revalidatePath(buildPath(orgSlug, '/previsionnel'))
  return { success: true, data: { count: copies.length } }
}
