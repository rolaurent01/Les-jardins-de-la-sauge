'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseSeedAdjustmentForm } from '@/lib/utils/seed-stock-parsers'
import type { ActionResult, SeedStockAdjustmentWithRelations, SeedStockLevel } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere le stock de graines par sachet (vue v_seed_stock) */
export async function fetchSeedStockLevels(): Promise<SeedStockLevel[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('v_seed_stock')
    .select('*')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur chargement stock graines : ${error.message}`)
  return (data ?? []) as unknown as SeedStockLevel[]
}

/** Recupere les ajustements (inventaires) de la ferme */
export async function fetchSeedAdjustments(): Promise<SeedStockAdjustmentWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seed_stock_adjustments')
    .select('*, seed_lots(id, lot_interne, variety_id, poids_sachet_g, varieties(id, nom_vernaculaire))')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur chargement inventaires graines : ${error.message}`)
  return (data ?? []) as unknown as SeedStockAdjustmentWithRelations[]
}

/** Recupere les sachets actifs (pour le select du formulaire) */
export async function fetchActiveSeedLots(): Promise<{ id: string; lot_interne: string; variety_id: string | null; poids_sachet_g: number | null; varieties: { id: string; nom_vernaculaire: string } | null }[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seed_lots')
    .select('id, lot_interne, variety_id, poids_sachet_g, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('lot_interne', { ascending: false })

  if (error) throw new Error(`Erreur chargement sachets : ${error.message}`)
  return (data ?? []) as unknown as typeof data & { varieties: { id: string; nom_vernaculaire: string } | null }[]
}

// ---- Actions ----

/** Cree un ajustement (inventaire) via RPC transactionnelle */
export async function createSeedAdjustment(formData: FormData): Promise<ActionResult> {
  const parsed = parseSeedAdjustmentForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_seed_adjustment', {
    p_farm_id: farmId,
    p_seed_lot_id: parsed.data.seed_lot_id,
    p_date: parsed.data.date,
    p_poids_constate_g: parsed.data.poids_constate_g,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
    p_uuid_client: null,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/graines'))
  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true, data: { id: data } }
}

/** Met a jour un ajustement via RPC transactionnelle */
export async function updateSeedAdjustment(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseSeedAdjustmentForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_seed_adjustment', {
    p_adjustment_id: id,
    p_date: parsed.data.date,
    p_poids_constate_g: parsed.data.poids_constate_g,
    p_commentaire: parsed.data.commentaire ?? null,
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/graines'))
  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true }
}

/** Supprime un ajustement via RPC transactionnelle */
export async function deleteSeedAdjustment(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_seed_adjustment', {
    p_adjustment_id: id,
    p_farm_id: farmId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/stock/graines'))
  revalidatePath(buildPath(orgSlug, '/semis/sachets'))
  return { success: true }
}
