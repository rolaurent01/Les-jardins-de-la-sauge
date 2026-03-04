'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseSoilWorkForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, SoilWork, SoilWorkWithRelations } from '@/lib/types'

const REVALIDATE_PATH = '/parcelles/travail-sol'

// ---- Requêtes ----

/** Récupère tous les travaux de sol avec rang, parcelle et site joints */
export async function fetchSoilWorks(): Promise<SoilWorkWithRelations[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('soil_works')
    .select('*, rows(id, numero, parcels(id, nom, code, sites(id, nom)))')
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

  const { data, error } = await supabase
    .from('soil_works')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
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

  const { data, error } = await supabase
    .from('soil_works')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as SoilWork }
}

/** Supprime définitivement un travail de sol (pas de soft delete sur cette table) */
export async function deleteSoilWork(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('soil_works')
    .delete()
    .eq('id', id)

  if (error) return { error: `Erreur lors de la suppression : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
