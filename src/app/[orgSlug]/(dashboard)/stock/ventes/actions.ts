'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseDirectSaleForm } from '@/lib/utils/affinage-stock-parsers'
import type { ActionResult, StockDirectSale, StockDirectSaleWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere toutes les ventes directes de la ferme courante avec variete jointe */
export async function fetchDirectSales(): Promise<StockDirectSaleWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('stock_direct_sales')
    .select('*, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des ventes : ${error.message}`)

  return (data ?? []) as unknown as StockDirectSaleWithVariety[]
}

// ---- Actions ----

/** Cree une vente directe + mouvement de stock via RPC transactionnelle */
export async function createDirectSale(formData: FormData): Promise<ActionResult<StockDirectSale>> {
  const parsed = parseDirectSaleForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_direct_sale_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_destinataire: parsed.data.destinataire ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
    p_uuid_client: null,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ventes'))
  return { success: true, data: { id: data } as unknown as StockDirectSale }
}

/** Met a jour une vente directe + son mouvement de stock via RPC transactionnelle */
export async function updateDirectSale(
  id: string,
  formData: FormData,
): Promise<ActionResult<StockDirectSale>> {
  const parsed = parseDirectSaleForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_direct_sale_with_stock', {
    p_sale_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_destinataire: parsed.data.destinataire ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ventes'))
  return { success: true, data: { id } as unknown as StockDirectSale }
}

/** Supprime une vente directe + son mouvement de stock via RPC transactionnelle */
export async function deleteDirectSale(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_direct_sale_with_stock', {
    p_sale_id: id,
    p_farm_id: farmId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/ventes'))
  return { success: true }
}
