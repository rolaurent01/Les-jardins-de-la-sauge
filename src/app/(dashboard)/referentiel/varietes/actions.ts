'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Variety } from '@/lib/types'

function parseVarietyForm(formData: FormData) {
  return {
    nom_vernaculaire: (formData.get('nom_vernaculaire') as string).trim(),
    nom_latin:        (formData.get('nom_latin') as string)?.trim()  || null,
    famille:          (formData.get('famille') as string)?.trim()    || null,
    type_cycle:       (formData.get('type_cycle') as string)         || null,
    duree_peremption_mois: parseInt(formData.get('duree_peremption_mois') as string) || 24,
    seuil_alerte_g:   formData.get('seuil_alerte_g')
                        ? parseFloat(formData.get('seuil_alerte_g') as string)
                        : null,
    notes:            (formData.get('notes') as string)?.trim()      || null,
  }
}

function mapSupabaseError(code: string | undefined, fallback: string): string {
  if (code === '23505') return 'Cette variété existe déjà (nom en doublon).'
  return fallback
}

export async function createVariety(
  formData: FormData
): Promise<ActionResult<Variety>> {
  const supabase = await createClient()
  const fields = parseVarietyForm(formData)

  if (!fields.nom_vernaculaire) {
    return { error: 'Le nom vernaculaire est obligatoire.' }
  }

  const { data, error } = await supabase
    .from('varieties')
    .insert(fields)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error.code, `Erreur : ${error.message}`) }

  revalidatePath('/referentiel/varietes')
  return { success: true, data: data as Variety }
}

export async function updateVariety(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const fields = parseVarietyForm(formData)

  if (!fields.nom_vernaculaire) {
    return { error: 'Le nom vernaculaire est obligatoire.' }
  }

  const { error } = await supabase
    .from('varieties')
    .update(fields)
    .eq('id', id)

  if (error) return { error: mapSupabaseError(error.code, `Erreur : ${error.message}`) }

  revalidatePath('/referentiel/varietes')
  return { success: true }
}

export async function archiveVariety(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('varieties')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  revalidatePath('/referentiel/varietes')
  return { success: true }
}

export async function restoreVariety(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('varieties')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  revalidatePath('/referentiel/varietes')
  return { success: true }
}
