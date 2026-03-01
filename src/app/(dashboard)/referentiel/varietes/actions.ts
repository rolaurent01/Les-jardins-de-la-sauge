'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Variety, TypeCycle, PartiePlante } from '@/lib/types'
import { PARTIES_PLANTE } from '@/lib/types'

const VALID_TYPE_CYCLES: TypeCycle[] = ['annuelle', 'bisannuelle', 'perenne', 'vivace']

function parseVarietyForm(formData: FormData): ReturnType<typeof _buildFields> | { error: string } {
  const rawCycle = (formData.get('type_cycle') as string) || ''
  const rawParties = formData.getAll('parties_utilisees') as string[]
  const parties = rawParties.filter((p): p is PartiePlante =>
    PARTIES_PLANTE.includes(p as PartiePlante)
  )

  if (parties.length === 0) {
    return { error: 'Sélectionnez au moins une partie utilisée.' }
  }

  return _buildFields(formData, rawCycle, parties)
}

function _buildFields(formData: FormData, rawCycle: string, parties: PartiePlante[]) {
  return {
    nom_vernaculaire: (formData.get('nom_vernaculaire') as string).trim(),
    nom_latin:        (formData.get('nom_latin') as string)?.trim()  || null,
    famille:          (formData.get('famille') as string)?.trim()    || null,
    type_cycle: (VALID_TYPE_CYCLES.includes(rawCycle as TypeCycle) ? rawCycle as TypeCycle : null),
    duree_peremption_mois: parseInt(formData.get('duree_peremption_mois') as string) || 24,
    parties_utilisees: parties,
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
  const parsed = parseVarietyForm(formData)
  if ('error' in parsed) return parsed

  if (!parsed.nom_vernaculaire) {
    return { error: 'Le nom vernaculaire est obligatoire.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('varieties')
    .insert(parsed)
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
  const parsed = parseVarietyForm(formData)
  if ('error' in parsed) return parsed

  if (!parsed.nom_vernaculaire) {
    return { error: 'Le nom vernaculaire est obligatoire.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('varieties')
    .update(parsed)
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
