'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseSortingForm } from '@/lib/utils/transformation-parsers'
import type { ActionResult, Sorting, SortingWithVariety } from '@/lib/types'

// ---- Requetes ----

/** Recupere tous les triages de la ferme courante avec variete jointe */
export async function fetchSortings(): Promise<SortingWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('sortings')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des triages : ${error.message}`)

  return (data ?? []) as unknown as SortingWithVariety[]
}

// ---- Actions ----

/** Cree un triage + mouvement de stock via RPC transactionnelle */
export async function createSorting(formData: FormData): Promise<ActionResult<Sorting>> {
  const parsed = parseSortingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_sorting_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_type: parsed.data.type,
    p_etat_plante: parsed.data.etat_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
    p_uuid_client: null,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/transformation/triage'))
  return { success: true, data: { id: data } as unknown as Sorting }
}

/** Met a jour un triage + son mouvement de stock via RPC transactionnelle */
export async function updateSorting(
  id: string,
  formData: FormData,
): Promise<ActionResult<Sorting>> {
  const parsed = parseSortingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_sorting_with_stock', {
    p_sorting_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_etat_plante: parsed.data.etat_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_updated_by: userId,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/transformation/triage'))
  return { success: true, data: { id } as unknown as Sorting }
}

/** Supprime un triage + son mouvement de stock via RPC transactionnelle */
export async function deleteSorting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_sorting_with_stock', {
    p_sorting_id: id,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/transformation/triage'))
  return { success: true }
}
