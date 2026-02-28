'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, ExternalMaterial } from '@/lib/types'

const REVALIDATE = '/referentiel/materiaux'

function parseMaterialForm(formData: FormData) {
  return {
    nom:   (formData.get('nom') as string).trim(),
    unite: (formData.get('unite') as string)?.trim() || 'g',
    notes: (formData.get('notes') as string)?.trim() || null,
  }
}

export async function createMaterial(formData: FormData): Promise<ActionResult<ExternalMaterial>> {
  const supabase = await createClient()
  const fields = parseMaterialForm(formData)

  if (!fields.nom) return { error: 'Le nom du matériau est obligatoire.' }

  const { data, error } = await supabase
    .from('external_materials')
    .insert(fields)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Un matériau avec ce nom existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true, data: data as ExternalMaterial }
}

export async function updateMaterial(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const fields = parseMaterialForm(formData)

  if (!fields.nom) return { error: 'Le nom du matériau est obligatoire.' }

  const { error } = await supabase
    .from('external_materials')
    .update(fields)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Un matériau avec ce nom existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function archiveMaterial(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('external_materials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function restoreMaterial(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('external_materials')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}
