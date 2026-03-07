'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseDryingForm } from '@/lib/utils/transformation-parsers'
import type { ActionResult, Drying, DryingWithVariety } from '@/lib/types'

// ---- Requetes ----

/** Recupere tous les sechages de la ferme courante avec variete jointe */
export async function fetchDryings(): Promise<DryingWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('dryings')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sechages : ${error.message}`)

  return (data ?? []) as unknown as DryingWithVariety[]
}

// ---- Actions ----

/** Cree un sechage + mouvement de stock via RPC transactionnelle */
export async function createDrying(formData: FormData): Promise<ActionResult<Drying>> {
  const parsed = parseDryingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_drying_with_stock', {
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

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true, data: { id: data } as unknown as Drying }
}

/** Met a jour un sechage + son mouvement de stock via RPC transactionnelle */
export async function updateDrying(
  id: string,
  formData: FormData,
): Promise<ActionResult<Drying>> {
  const parsed = parseDryingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_drying_with_stock', {
    p_drying_id: id,
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

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true, data: { id } as unknown as Drying }
}

/** Supprime un sechage + son mouvement de stock via RPC transactionnelle */
export async function deleteDrying(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_drying_with_stock', {
    p_drying_id: id,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true }
}
