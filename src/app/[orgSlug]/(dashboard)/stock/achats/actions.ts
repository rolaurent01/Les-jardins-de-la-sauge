'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parsePurchaseForm } from '@/lib/utils/affinage-stock-parsers'
import type { ActionResult, StockPurchase, StockPurchaseWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere tous les achats de la ferme courante avec variete jointe */
export async function fetchPurchases(): Promise<StockPurchaseWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('stock_purchases')
    .select('*, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des achats : ${error.message}`)

  return (data ?? []) as unknown as StockPurchaseWithVariety[]
}

// ---- Actions ----

/** Cree un achat + mouvement de stock via RPC transactionnelle */
export async function createPurchase(formData: FormData): Promise<ActionResult<StockPurchase>> {
  const parsed = parsePurchaseForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_purchase_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_fournisseur: parsed.data.fournisseur,
    p_numero_lot_fournisseur: parsed.data.numero_lot_fournisseur ?? '',
    p_certif_ab: parsed.data.certif_ab,
    p_prix: parsed.data.prix ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_created_by: userId,
    p_uuid_client: '',
    p_external_material_id: undefined,
    p_numero_facture: undefined,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/achats'))
  return { success: true, data: { id: data } as unknown as StockPurchase }
}

/** Met a jour un achat + son mouvement de stock via RPC transactionnelle */
export async function updatePurchase(
  id: string,
  formData: FormData,
): Promise<ActionResult<StockPurchase>> {
  const parsed = parsePurchaseForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_purchase_with_stock', {
    p_purchase_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_etat_plante: parsed.data.etat_plante,
    p_poids_g: parsed.data.poids_g,
    p_fournisseur: parsed.data.fournisseur,
    p_numero_lot_fournisseur: parsed.data.numero_lot_fournisseur ?? '',
    p_certif_ab: parsed.data.certif_ab,
    p_prix: parsed.data.prix ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_updated_by: userId,
    p_external_material_id: undefined,
    p_numero_facture: undefined,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/achats'))
  return { success: true, data: { id } as unknown as StockPurchase }
}

/** Supprime un achat + son mouvement de stock via RPC transactionnelle */
export async function deletePurchase(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_purchase_with_stock', {
    p_purchase_id: id,
    p_farm_id: farmId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/achats'))
  return { success: true }
}
