'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseCuttingForm } from '@/lib/utils/transformation-parsers'
import type { ActionResult, Cutting, CuttingWithVariety } from '@/lib/types'

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
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
    p_uuid_client: null,
  })

  if (error) return { error: `Erreur : ${error.message}` }

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
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_updated_by: userId,
  })

  if (error) return { error: `Erreur : ${error.message}` }

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

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/transformation/tronconnage'))
  return { success: true }
}
