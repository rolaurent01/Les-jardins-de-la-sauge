'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseRowCareForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, RowCare, RowCareWithRelations } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requêtes ----

/** Récupère tous les suivis de rang de la ferme courante avec rang, parcelle, site et variété joints */
export async function fetchRowCare(): Promise<RowCareWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('row_care')
    .select('*, rows(id, numero, parcels(id, nom, code, sites(id, nom))), varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des suivis de rang : ${error.message}`)

  return (data ?? []) as unknown as RowCareWithRelations[]
}

// ---- Actions ----

/** Crée un nouveau suivi de rang */
export async function createRowCare(formData: FormData): Promise<ActionResult<RowCare>> {
  const parsed = parseRowCareForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('row_care')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...parsed.data, farm_id: farmId, created_by: userId } as any)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/suivi-rang'))
  return { success: true, data: data as RowCare }
}

/** Met à jour un suivi de rang existant */
export async function updateRowCare(
  id: string,
  formData: FormData,
): Promise<ActionResult<RowCare>> {
  const parsed = parseRowCareForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('row_care')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...parsed.data, updated_by: userId } as any)
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/suivi-rang'))
  return { success: true, data: data as RowCare }
}

/** Supprime définitivement un suivi de rang (pas de soft delete sur cette table) */
export async function deleteRowCare(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('row_care')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/suivi-rang'))
  return { success: true }
}
