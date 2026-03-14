'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseUprootingForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, Uprooting, UprootingWithRelations } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere tous les arrachages de la ferme courante avec rang, parcelle, site et variete joints */
export async function fetchUprootings(): Promise<UprootingWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('uprootings')
    .select('*, rows(id, numero, parcels(id, nom, code, sites(id, nom))), varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des arrachages : ${error.message}`)

  return (data ?? []) as unknown as UprootingWithRelations[]
}

// ---- Actions ----

/** Cree un nouvel arrachage et desactive les plantings correspondants */
export async function createUprooting(formData: FormData): Promise<ActionResult<Uprooting>> {
  const parsed = parseUprootingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('uprootings')
    .insert({ ...parsed.data, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  // Desactiver les plantings actifs correspondants
  const plantingFilter = supabase
    .from('plantings')
    .update({ actif: false, updated_by: userId })
    .eq('row_id', parsed.data.row_id)
    .eq('actif', true)
    .is('deleted_at', null)

  const plantingQuery = parsed.data.variety_id
    ? plantingFilter.eq('variety_id', parsed.data.variety_id)
    : plantingFilter

  const { error: plantingError } = await plantingQuery

  if (plantingError) {
    // Cas degrade : l'arrachage est enregistre mais les plantings n'ont pas ete desactives
    // eslint-disable-next-line no-console
    console.error('[arrachage] Erreur desactivation plantings:', plantingError.message)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/arrachage'))
  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  return { success: true, data: data as Uprooting }
}

/** Met a jour un arrachage existant */
export async function updateUprooting(
  id: string,
  formData: FormData,
): Promise<ActionResult<Uprooting>> {
  const parsed = parseUprootingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('uprootings')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/arrachage'))
  return { success: true, data: data as Uprooting }
}

/** Supprime definitivement un arrachage et reactive les plantings desactives */
export async function deleteUprooting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // 1. Recuperer l'arrachage pour connaitre row_id et variety_id
  const { data: uprooting } = await supabase
    .from('uprootings')
    .select('row_id, variety_id')
    .eq('id', id)
    .eq('farm_id', farmId)
    .single()

  if (uprooting) {
    // 2. Reactiver les plantings correspondants
    let query = supabase
      .from('plantings')
      .update({ actif: true, updated_by: userId })
      .eq('row_id', uprooting.row_id)
      .eq('actif', false)
      .is('deleted_at', null)

    if (uprooting.variety_id) {
      query = query.eq('variety_id', uprooting.variety_id)
    }

    await query
  }

  // 3. Supprimer l'arrachage
  const { error } = await supabase
    .from('uprootings')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/arrachage'))
  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  return { success: true }
}
