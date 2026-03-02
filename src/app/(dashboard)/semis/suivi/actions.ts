'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { seedlingSchema } from '@/lib/validation/semis'
import { parseSeedlingForm } from '@/lib/utils/semis-parsers'
import type { ActionResult, Seedling, SeedlingWithRelations } from '@/lib/types'

// ---- Helpers ----

/** Normalise les champs nb_mortes_* de null → 0 pour satisfaire les types Supabase.
 *  Ces colonnes sont NOT NULL DEFAULT 0 en base, elles n'acceptent pas null. */
function normalizeMortesFields(
  d: ReturnType<typeof seedlingSchema.parse>,
): ReturnType<typeof seedlingSchema.parse> & {
  nb_mortes_mottes: number
  nb_mortes_caissette: number
  nb_mortes_godet: number
} {
  return {
    ...d,
    nb_mortes_mottes: d.nb_mortes_mottes ?? 0,
    nb_mortes_caissette: d.nb_mortes_caissette ?? 0,
    nb_mortes_godet: d.nb_mortes_godet ?? 0,
  }
}

// ---- Requêtes ----

/** Récupère tous les semis actifs avec variété et sachet joints */
export async function fetchSeedlings(): Promise<SeedlingWithRelations[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seedlings')
    .select('*, varieties(id, nom_vernaculaire), seed_lots(id, lot_interne)')
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des semis : ${error.message}`)

  return (data ?? []) as SeedlingWithRelations[]
}

/** Récupère les sachets actifs pour le sélecteur du formulaire */
export async function fetchSeedLotsForSelect(): Promise<
  { id: string; lot_interne: string; varieties: { nom_vernaculaire: string } | null }[]
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seed_lots')
    .select('id, lot_interne, varieties(nom_vernaculaire)')
    .is('deleted_at', null)
    .order('lot_interne', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sachets : ${error.message}`)

  return (data ?? []) as { id: string; lot_interne: string; varieties: { nom_vernaculaire: string } | null }[]
}

// ---- Actions ----

/** Crée un nouveau semis */
export async function createSeedling(formData: FormData): Promise<ActionResult<Seedling>> {
  const parsed = parseSeedlingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seedlings')
    .insert(normalizeMortesFields(parsed.data))
    .select()
    .single()

  if (error) return { error: `Erreur lors de la création du semis : ${error.message}` }

  revalidatePath('/semis/suivi')
  return { success: true, data: data as Seedling }
}

/** Met à jour un semis existant.
 *  Le changement de processus est autorisé : les champs de l'ancien processus
 *  sont remis à null par parseSeedlingForm. */
export async function updateSeedling(
  id: string,
  formData: FormData,
): Promise<ActionResult<Seedling>> {
  const parsed = parseSeedlingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seedlings')
    .update(normalizeMortesFields(parsed.data))
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur lors de la mise à jour du semis : ${error.message}` }

  revalidatePath('/semis/suivi')
  return { success: true, data: data as Seedling }
}

/** Archive un semis (soft delete) */
export async function archiveSeedling(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seedlings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage du semis : ${error.message}` }

  revalidatePath('/semis/suivi')
  return { success: true }
}

/** Restaure un semis archivé */
export async function restoreSeedling(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seedlings')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration du semis : ${error.message}` }

  revalidatePath('/semis/suivi')
  return { success: true }
}
