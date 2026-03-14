'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import type { ActionResult, ExternalMaterial } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

function parseMaterialForm(formData: FormData) {
  return {
    nom:   (formData.get('nom') as string).trim(),
    unite: (formData.get('unite') as string)?.trim() || 'g',
    notes: (formData.get('notes') as string)?.trim() || null,
  }
}

export async function createMaterial(formData: FormData): Promise<ActionResult<ExternalMaterial>> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()
  const fields = parseMaterialForm(formData)

  if (!fields.nom) return { error: 'Le nom du matériau est obligatoire.' }

  const { data, error } = await supabase
    .from('external_materials')
    .insert({ ...fields, created_by_farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Un matériau avec ce nom existe déjà.' }
    return { error: mapSupabaseError(error) }
  }

  revalidatePath(buildPath(orgSlug, '/referentiel/materiaux'))
  return { success: true, data: data as ExternalMaterial }
}

export async function updateMaterial(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()
  const fields = parseMaterialForm(formData)

  if (!fields.nom) return { error: 'Le nom du matériau est obligatoire.' }

  const { error } = await supabase
    .from('external_materials')
    .update({ ...fields, updated_by: userId })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Un matériau avec ce nom existe déjà.' }
    return { error: mapSupabaseError(error) }
  }

  revalidatePath(buildPath(orgSlug, '/referentiel/materiaux'))
  return { success: true }
}

export async function archiveMaterial(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('external_materials')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)

  if (error) return { error: mapSupabaseError(error) }
  revalidatePath(buildPath(orgSlug, '/referentiel/materiaux'))
  return { success: true }
}

export async function restoreMaterial(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('external_materials')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)

  if (error) return { error: mapSupabaseError(error) }
  revalidatePath(buildPath(orgSlug, '/referentiel/materiaux'))
  return { success: true }
}
