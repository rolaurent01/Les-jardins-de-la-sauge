'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseSoilWorkForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, SoilWork, SoilWorkWithRelations } from '@/lib/types'

// ---- Requêtes ----

/** Récupère tous les travaux de sol de la ferme courante avec rang, parcelle et site joints */
export async function fetchSoilWorks(): Promise<SoilWorkWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('soil_works')
    .select('*, rows(id, numero, parcels(id, nom, code, sites(id, nom)))')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des travaux de sol : ${error.message}`)

  return (data ?? []) as SoilWorkWithRelations[]
}

// ---- Actions ----

/** Crée un nouveau travail de sol */
export async function createSoilWork(formData: FormData): Promise<ActionResult<SoilWork>> {
  const parsed = parseSoilWorkForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('soil_works')
    .insert({ ...parsed.data, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/travail-sol'))
  return { success: true, data: data as SoilWork }
}

/** Met à jour un travail de sol existant */
export async function updateSoilWork(
  id: string,
  formData: FormData,
): Promise<ActionResult<SoilWork>> {
  const parsed = parseSoilWorkForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('soil_works')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/travail-sol'))
  return { success: true, data: data as SoilWork }
}

/** Supprime définitivement un travail de sol (pas de soft delete sur cette table) */
export async function deleteSoilWork(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await supabase
    .from('soil_works')
    .delete()
    .eq('id', id)

  if (error) return { error: `Erreur lors de la suppression : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/travail-sol'))
  return { success: true }
}
