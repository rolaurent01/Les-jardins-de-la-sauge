'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseOccultationForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, Occultation, OccultationWithRelations } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere toutes les occultations de la ferme courante avec rang, parcelle et site joints */
export async function fetchOccultations(): Promise<OccultationWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('occultations')
    .select('*, rows(id, numero, parcels(id, nom, code, sites(id, nom)))')
    .eq('farm_id', farmId)
    .order('date_debut', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des occultations : ${error.message}`)

  return (data ?? []) as unknown as OccultationWithRelations[]
}

/** Recupere les noms d'engrais verts distincts pour l'autocompletion */
export async function fetchEngraisVertNoms(): Promise<string[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('occultations')
    .select('engrais_vert_nom')
    .eq('farm_id', farmId)
    .not('engrais_vert_nom', 'is', null)
    .order('engrais_vert_nom')

  if (error) throw new Error(`Erreur lors du chargement des noms d'engrais verts : ${error.message}`)

  // Deduplication manuelle (pas de DISTINCT dans PostgREST)
  const unique = [...new Set((data ?? []).map(d => d.engrais_vert_nom as string))]
  return unique.sort((a, b) => a.localeCompare(b, 'fr'))
}

// ---- Actions ----

/** Cree une nouvelle occultation */
export async function createOccultation(formData: FormData): Promise<ActionResult<Occultation>> {
  const parsed = parseOccultationForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('occultations')
    .insert({ ...parsed.data, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/occultation'))
  return { success: true, data: data as Occultation }
}

/** Met a jour une occultation existante */
export async function updateOccultation(
  id: string,
  formData: FormData,
): Promise<ActionResult<Occultation>> {
  const parsed = parseOccultationForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('occultations')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/occultation'))
  return { success: true, data: data as Occultation }
}

/** Supprime definitivement une occultation (pas de soft delete) */
export async function deleteOccultation(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('occultations')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/parcelles/occultation'))
  return { success: true }
}
