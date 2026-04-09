'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseAdjustmentForm } from '@/lib/utils/affinage-stock-parsers'
import type { ActionResult, StockAdjustment, StockAdjustmentWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere tous les ajustements de la ferme courante avec variete jointe */
export async function fetchAdjustments(): Promise<StockAdjustmentWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des ajustements : ${error.message}`)

  return (data ?? []) as unknown as StockAdjustmentWithVariety[]
}

// ---- Actions ----

/** Cree un ajustement + mouvement de stock via RPC transactionnelle */
export async function createAdjustment(formData: FormData): Promise<ActionResult<StockAdjustment>> {
  const parsed = parseAdjustmentForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_adjustment_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_type_mouvement: parsed.data.type_mouvement,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_motif: parsed.data.motif,
    p_commentaire: parsed.data.commentaire ?? '',
    p_created_by: userId,
    p_uuid_client: '',
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ajustements'))
  return { success: true, data: { id: data } as unknown as StockAdjustment }
}

/** Met a jour un ajustement + son mouvement de stock via RPC transactionnelle */
export async function updateAdjustment(
  id: string,
  formData: FormData,
): Promise<ActionResult<StockAdjustment>> {
  const parsed = parseAdjustmentForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_adjustment_with_stock', {
    p_adjustment_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_type_mouvement: parsed.data.type_mouvement,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_motif: parsed.data.motif,
    p_commentaire: parsed.data.commentaire ?? '',
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ajustements'))
  return { success: true, data: { id } as unknown as StockAdjustment }
}

/** Supprime un ajustement + son mouvement de stock via RPC transactionnelle */
export async function deleteAdjustment(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_adjustment_with_stock', {
    p_adjustment_id: id,
    p_farm_id: farmId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ajustements'))
  return { success: true }
}
