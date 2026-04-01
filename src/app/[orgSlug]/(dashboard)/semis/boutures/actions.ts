'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseCuttingForm } from '@/lib/utils/boutures-parsers'
import { computeCuttingStatut } from '@/lib/utils/cutting-statut'
import type { ActionResult, Bouture, BoutureWithRelations } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Helpers ----

/**
 * Calcule la somme des plants plantés (actifs, non-supprimés) pour un cutting donné.
 */
async function getPlantsPlantes(cuttingId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('plantings')
    .select('nb_plants')
    .eq('bouture_id', cuttingId)
    .eq('actif', true)
    .is('deleted_at', null)

  return (data ?? []).reduce((sum, p) => sum + ((p.nb_plants as number) ?? 0), 0)
}

/**
 * Recalcule et met à jour le statut d'une bouture en base.
 * Appelé après chaque modification d'un cutting ou d'un planting lié.
 */
export async function recalculateCuttingStatut(cuttingId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: cutting } = await admin
    .from('boutures')
    .select('nb_plaques, date_rempotage, nb_plants_obtenus')
    .eq('id', cuttingId)
    .single()

  if (!cutting) return

  const plantsPlantes = await getPlantsPlantes(cuttingId)

  const newStatut = computeCuttingStatut(
    {
      nb_plaques: cutting.nb_plaques,
      date_rempotage: cutting.date_rempotage,
      nb_plants_obtenus: cutting.nb_plants_obtenus,
    },
    plantsPlantes,
  )

  await admin
    .from('boutures')
    .update({ statut: newStatut })
    .eq('id', cuttingId)
}

// ---- Types pour les fiches ----

/** Bouture enrichie avec le nombre de plants plantés (calculé) */
export type CuttingWithPlantsInfo = BoutureWithRelations & {
  plants_plantes: number
  plants_restants: number | null
}

// ---- Requêtes ----

/** Récupère toutes les boutures actives de la ferme courante avec variété jointe */
export async function fetchCuttings(): Promise<CuttingWithPlantsInfo[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('boutures')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_bouturage', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des boutures : ${error.message}`)

  const cuttings = (data ?? []) as unknown as BoutureWithRelations[]

  // Charger les plants plantés pour chaque cutting en un seul appel
  const cuttingIds = cuttings.map(c => c.id)

  let plantingsByCutting: Record<string, number> = {}
  if (cuttingIds.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('bouture_id, nb_plants')
      .in('bouture_id', cuttingIds)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { bouture_id: string; nb_plants: number | null }[]) {
      if (p.bouture_id) {
        plantingsByCutting[p.bouture_id] = (plantingsByCutting[p.bouture_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return cuttings.map(c => {
    const plantsPlantes = plantingsByCutting[c.id] ?? 0
    const plantsRestants = c.nb_plants_obtenus != null
      ? Math.max(0, c.nb_plants_obtenus - plantsPlantes)
      : null
    return {
      ...c,
      plants_plantes: plantsPlantes,
      plants_restants: plantsRestants,
    }
  })
}

// ---- Actions ----

/** Crée une nouvelle bouture */
export async function createCutting(formData: FormData): Promise<ActionResult<Bouture>> {
  const parsed = parseCuttingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Calculer le statut initial
  const statut = computeCuttingStatut(
    {
      nb_plaques: parsed.data.nb_plaques ?? null,
      date_rempotage: parsed.data.date_rempotage ?? null,
      nb_plants_obtenus: parsed.data.nb_plants_obtenus ?? null,
    },
    0, // pas de plantings à la création
  )

  const { data, error } = await supabase
    .from('boutures')
    .insert({ ...parsed.data, nb_mortes_plaque: parsed.data.nb_mortes_plaque ?? 0, nb_mortes_godet: parsed.data.nb_mortes_godet ?? 0, statut, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true, data: data as unknown as Bouture }
}

/** Met à jour une bouture existante */
export async function updateCutting(
  id: string,
  formData: FormData,
): Promise<ActionResult<Bouture>> {
  const parsed = parseCuttingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Calculer le nombre de plants plantés pour recalculer le statut
  const plantsPlantes = await getPlantsPlantes(id)

  const statut = computeCuttingStatut(
    {
      nb_plaques: parsed.data.nb_plaques ?? null,
      date_rempotage: parsed.data.date_rempotage ?? null,
      nb_plants_obtenus: parsed.data.nb_plants_obtenus ?? null,
    },
    plantsPlantes,
  )

  const { data, error } = await supabase
    .from('boutures')
    .update({ ...parsed.data, nb_mortes_plaque: parsed.data.nb_mortes_plaque ?? 0, nb_mortes_godet: parsed.data.nb_mortes_godet ?? 0, statut, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true, data: data as unknown as Bouture }
}

/** Archive une bouture (soft delete) */
export async function archiveCutting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('boutures')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true }
}

/** Restaure une bouture archivée */
export async function restoreCutting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('boutures')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  // Recalculer le statut après restauration
  await recalculateCuttingStatut(id)

  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true }
}
