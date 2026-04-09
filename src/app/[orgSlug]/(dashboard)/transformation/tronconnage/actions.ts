'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseCuttingForm, parseCuttingCombinedForm } from '@/lib/utils/transformation-parsers'
import type { ActionResult, Cutting, CuttingWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere tous les tronconnages de la ferme courante avec variete jointe */
export async function fetchCuttings(): Promise<CuttingWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('cuttings')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des tronconnages : ${error.message}`)

  return (data ?? []) as unknown as CuttingWithVariety[]
}

// ---- Actions ----

/** Cree un tronconnage + mouvement de stock via RPC transactionnelle */
export async function createCutting(formData: FormData): Promise<ActionResult<Cutting>> {
  const parsed = parseCuttingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_cutting_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_type: parsed.data.type,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_created_by: userId,
    p_uuid_client: undefined,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true, data: { id: data } as unknown as Cutting }
}

/** Met a jour un tronconnage + son mouvement de stock via RPC transactionnelle */
export async function updateCutting(
  id: string,
  formData: FormData,
): Promise<ActionResult<Cutting>> {
  const parsed = parseCuttingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_cutting_with_stock', {
    p_cutting_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true, data: { id } as unknown as Cutting }
}

/** Supprime un tronconnage + son mouvement de stock via RPC transactionnelle */
export async function deleteCutting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_cutting_with_stock', {
    p_cutting_id: id,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true }
}

/** Cree un tronconnage combine (entree + sortie) via RPC transactionnelle */
export async function createCuttingCombined(formData: FormData): Promise<ActionResult> {
  const parsed = parseCuttingCombinedForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('create_cutting_combined', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_poids_entree_g: parsed.data.poids_entree_g,
    p_poids_sortie_g: parsed.data.poids_sortie_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_created_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true }
}

/** Met a jour un tronconnage combine (entree + sortie) via RPC transactionnelle */
export async function updateCuttingCombined(
  entreeId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseCuttingCombinedForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('update_cutting_combined', {
    p_entree_id: entreeId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_poids_entree_g: parsed.data.poids_entree_g,
    p_poids_sortie_g: parsed.data.poids_sortie_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true }
}

/** Supprime un tronconnage + son paired via RPC transactionnelle */
export async function deleteCuttingPaired(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('delete_cutting_paired', {
    p_cutting_id: id,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true }
}
