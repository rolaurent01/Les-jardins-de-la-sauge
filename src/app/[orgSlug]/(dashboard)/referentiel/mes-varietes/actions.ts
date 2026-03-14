'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import type { ActionResult } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

/** Variété enrichie du statut de sélection pour la ferme */
export type VarietyWithSetting = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  type_cycle: string | null
  parties_utilisees: string[]
  isSelected: boolean
  seuil_alerte_g: number | null
}

/**
 * Récupère toutes les variétés du catalogue avec leur statut pour la ferme active.
 * isSelected = true si pas d'entrée farm_variety_settings OU hidden = false.
 */
export async function fetchVarietiesWithSettings(): Promise<VarietyWithSetting[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  // Variétés actives du catalogue
  const { data: varieties, error } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille, type_cycle, parties_utilisees')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('nom_vernaculaire')

  if (error) throw new Error(`Erreur lors du chargement des variétés : ${error.message}`)

  // Préférences de la ferme
  const { data: settings } = await supabase
    .from('farm_variety_settings')
    .select('variety_id, hidden, seuil_alerte_g')
    .eq('farm_id', farmId)

  const settingsMap = new Map(
    (settings ?? []).map((s) => [s.variety_id, s])
  )

  return (varieties ?? []).map((v) => {
    const setting = settingsMap.get(v.id)
    return {
      id: v.id,
      nom_vernaculaire: v.nom_vernaculaire,
      nom_latin: v.nom_latin,
      famille: v.famille,
      type_cycle: v.type_cycle,
      parties_utilisees: v.parties_utilisees ?? [],
      isSelected: !setting || setting.hidden === false,
      seuil_alerte_g: setting?.seuil_alerte_g ?? null,
    }
  })
}

/**
 * Vérifie si la ferme a au moins une entrée dans farm_variety_settings.
 * Sert à détecter le mode onboarding (première visite).
 */
export async function hasExistingSettings(): Promise<boolean> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { count, error } = await supabase
    .from('farm_variety_settings')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur vérification settings : ${error.message}`)

  return (count ?? 0) > 0
}

/**
 * Toggle une variété (visible / masquée) pour la ferme active.
 * UPSERT dans farm_variety_settings.
 */
export async function toggleVariety(
  varietyId: string,
  hidden: boolean,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('farm_variety_settings')
    .upsert(
      { farm_id: farmId, variety_id: varietyId, hidden },
      { onConflict: 'farm_id,variety_id' },
    )

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/referentiel/mes-varietes'))
  return { success: true }
}

/**
 * Applique la sélection en masse (mode onboarding).
 * Variétés cochées → hidden = false, non cochées → hidden = true.
 */
export async function bulkSetVarieties(
  selectedVarietyIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  // Toutes les variétés actives du catalogue
  const { data: allVarieties, error: fetchError } = await supabase
    .from('varieties')
    .select('id')
    .is('deleted_at', null)
    .is('merged_into_id', null)

  if (fetchError) return { error: `Erreur lors du chargement : ${fetchError.message}` }

  const selectedSet = new Set(selectedVarietyIds)

  // Construire les upserts en batch
  const upserts = (allVarieties ?? []).map((v) => ({
    farm_id: farmId,
    variety_id: v.id,
    hidden: !selectedSet.has(v.id),
  }))

  const { error } = await supabase
    .from('farm_variety_settings')
    .upsert(upserts, { onConflict: 'farm_id,variety_id' })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/referentiel/mes-varietes'))
  return { success: true }
}

/**
 * Met à jour le seuil d'alerte stock bas pour une variété/ferme.
 */
export async function updateSeuilAlerte(
  varietyId: string,
  seuil_alerte_g: number | null,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('farm_variety_settings')
    .upsert(
      { farm_id: farmId, variety_id: varietyId, seuil_alerte_g },
      { onConflict: 'farm_id,variety_id' },
    )

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/referentiel/mes-varietes'))
  return { success: true }
}

/**
 * Supprime tous les farm_variety_settings de la ferme → repasse en mode onboarding.
 */
export async function resetFarmSettings(): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('farm_variety_settings')
    .delete()
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/referentiel/mes-varietes'))
  return { success: true }
}
