'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseHarvestForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, Harvest, HarvestWithRelations } from '@/lib/types'

// ---- Requetes ----

/** Recupere toutes les cueillettes actives de la ferme courante avec variete et rang joints */
export async function fetchHarvests(): Promise<HarvestWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('harvests')
    .select(
      '*, varieties(id, nom_vernaculaire), rows(id, numero, parcels(id, nom))',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des cueillettes : ${error.message}`)

  return (data ?? []) as unknown as HarvestWithRelations[]
}

/** Recupere les lieux sauvages distincts pour l'autocompletion */
export async function fetchLieuxSauvages(): Promise<string[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('harvests')
    .select('lieu_sauvage')
    .eq('farm_id', farmId)
    .not('lieu_sauvage', 'is', null)

  if (error) throw new Error(`Erreur lors du chargement des lieux sauvages : ${error.message}`)

  // Deduplication et tri cote JS
  const unique = [...new Set((data ?? []).map(d => d.lieu_sauvage as string))]
  unique.sort((a, b) => a.localeCompare(b, 'fr'))
  return unique
}

// ---- Actions ----

/**
 * Cree une cueillette + mouvement de stock d'entree (frais) via RPC transactionnelle.
 * Les deux INSERT sont dans la meme transaction SQL — impossible d'avoir un harvest sans stock_movement.
 */
export async function createHarvest(formData: FormData): Promise<ActionResult<Harvest>> {
  const parsed = parseHarvestForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_harvest_with_stock', {
    p_farm_id: farmId,
    p_uuid_client: null,
    p_type_cueillette: parsed.data.type_cueillette,
    p_row_id: parsed.data.row_id ?? null,
    p_lieu_sauvage: parsed.data.lieu_sauvage ?? null,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/cueillette'))
  return { success: true, data: { id: data } as unknown as Harvest }
}

/**
 * Met a jour une cueillette existante + son mouvement de stock correspondant.
 * Le stock_movement est identifie via source_type='cueillette' + source_id=harvest.id.
 */
export async function updateHarvest(
  id: string,
  formData: FormData,
): Promise<ActionResult<Harvest>> {
  const parsed = parseHarvestForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  // RPC transactionnelle : harvest + stock_movement dans la meme transaction
  const { error } = await supabase.rpc('update_harvest_with_stock', {
    p_harvest_id: id,
    p_type_cueillette: parsed.data.type_cueillette,
    p_row_id: parsed.data.row_id ?? null,
    p_lieu_sauvage: parsed.data.lieu_sauvage ?? null,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_updated_by: userId,
  })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/cueillette'))
  return { success: true, data: { id } as unknown as Harvest }
}

/** Soft delete d'une cueillette + archivage du stock_movement correspondant */
export async function archiveHarvest(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const now = new Date().toISOString()

  // 1. Archiver le harvest
  const { error } = await supabase
    .from('harvests')
    .update({ deleted_at: now, updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  // 2. Archiver le stock_movement correspondant
  const { error: stockError } = await supabase
    .from('stock_movements')
    .update({ deleted_at: now })
    .eq('source_type', 'cueillette')
    .eq('source_id', id)

  if (stockError) return { error: `Erreur archivage stock : ${stockError.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/cueillette'))
  return { success: true }
}

/** Restaure une cueillette archivee + son stock_movement */
export async function restoreHarvest(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  // 1. Restaurer le harvest
  const { error } = await supabase
    .from('harvests')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  // 2. Restaurer le stock_movement correspondant
  const { error: stockError } = await supabase
    .from('stock_movements')
    .update({ deleted_at: null })
    .eq('source_type', 'cueillette')
    .eq('source_id', id)

  if (stockError) return { error: `Erreur restauration stock : ${stockError.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/cueillette'))
  return { success: true }
}
