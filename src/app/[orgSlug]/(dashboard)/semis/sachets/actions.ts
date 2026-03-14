'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { generateSeedLotNumber } from '@/lib/utils/lots'
import { parseSeedLotForm } from '@/lib/utils/semis-parsers'
import type { ActionResult, SeedLot, SeedLotWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requêtes ----

/** Récupère les variétés actives pour le dropdown du formulaire, filtrées par les préférences ferme */
export async function fetchVarieties(): Promise<Pick<import('@/lib/types').Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data: varieties, error } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('nom_vernaculaire')

  if (error) throw new Error(`Erreur lors du chargement des variétés : ${error.message}`)

  // Variétés masquées par cette ferme (préférence farm_variety_settings)
  const { data: hidden } = await supabase
    .from('farm_variety_settings')
    .select('variety_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = new Set((hidden ?? []).map((h) => h.variety_id))
  return (varieties ?? []).filter((v) => !hiddenIds.has(v.id))
}

/** Récupère tous les sachets actifs de la ferme courante, avec leur variété jointe */
export async function fetchSeedLots(): Promise<SeedLotWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seed_lots')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sachets : ${error.message}`)

  return (data ?? []) as unknown as SeedLotWithVariety[]
}

// ---- Actions ----

/** Crée un nouveau sachet de graines avec numéro interne auto-généré (scopé par ferme) */
export async function createSeedLot(formData: FormData): Promise<ActionResult<SeedLot>> {
  const parsed = parseSeedLotForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()
  const year = new Date().getFullYear()

  // Comptage scopé par ferme pour la numérotation séquentielle
  const { count, error: countError } = await supabase
    .from('seed_lots')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)
    .like('lot_interne', `SL-${year}-%`)

  if (countError) {
    return { error: mapSupabaseError(countError) }
  }

  const lot_interne = generateSeedLotNumber(year, count ?? 0)

  const { data, error } = await supabase
    .from('seed_lots')
    .insert({ ...parsed.data, lot_interne, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true, data: data as SeedLot }
}

/** Met à jour un sachet existant (lot_interne immutable) */
export async function updateSeedLot(
  id: string,
  formData: FormData,
): Promise<ActionResult<SeedLot>> {
  const parsed = parseSeedLotForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // lot_interne est intentionnellement exclu : il ne doit jamais être modifié après création
  const { data, error } = await supabase
    .from('seed_lots')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true, data: data as SeedLot }
}

/** Archive un sachet (soft delete) */
export async function archiveSeedLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('seed_lots')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true }
}

/** Restaure un sachet archivé */
export async function restoreSeedLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('seed_lots')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true }
}
