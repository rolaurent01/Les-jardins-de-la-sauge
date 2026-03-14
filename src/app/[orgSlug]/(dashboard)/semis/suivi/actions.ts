'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { seedlingSchema } from '@/lib/validation/semis'
import { parseSeedlingForm } from '@/lib/utils/semis-parsers'
import { computeSeedlingStatut } from '@/lib/utils/seedling-statut'
import type { ActionResult, Seedling, SeedlingWithRelations } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

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

/**
 * Calcule la somme des plants plantés (actifs, non-supprimés) pour un seedling donné.
 */
async function getPlantsPlantes(seedlingId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('plantings')
    .select('nb_plants')
    .eq('seedling_id', seedlingId)
    .eq('actif', true)
    .is('deleted_at', null)

  return (data ?? []).reduce((sum, p) => sum + ((p.nb_plants as number) ?? 0), 0)
}

/**
 * Recalcule et met à jour le statut d'un seedling en base.
 * Appelé après chaque modification d'un seedling ou d'un planting lié.
 */
export async function recalculateSeedlingStatut(seedlingId: string): Promise<void> {
  const admin = createAdminClient()

  // Charger le seedling
  const { data: seedling } = await admin
    .from('seedlings')
    .select('processus, date_levee, date_repiquage, nb_plants_obtenus')
    .eq('id', seedlingId)
    .single()

  if (!seedling) return

  const plantsPlantes = await getPlantsPlantes(seedlingId)

  const newStatut = computeSeedlingStatut(
    {
      processus: seedling.processus as 'mini_motte' | 'caissette_godet',
      date_levee: seedling.date_levee,
      date_repiquage: seedling.date_repiquage,
      nb_plants_obtenus: seedling.nb_plants_obtenus,
    },
    plantsPlantes,
  )

  await admin
    .from('seedlings')
    .update({ statut: newStatut })
    .eq('id', seedlingId)
}

// ---- Types pour les fiches ----

/** Seedling enrichi avec le nombre de plants plantés (calculé) */
export type SeedlingWithPlantsInfo = SeedlingWithRelations & {
  plants_plantes: number
  plants_restants: number | null
}

// ---- Requêtes ----

/** Récupère tous les semis actifs de la ferme courante avec variété et sachet joints */
export async function fetchSeedlings(): Promise<SeedlingWithPlantsInfo[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seedlings')
    .select('*, varieties(id, nom_vernaculaire, nom_latin), seed_lots(id, lot_interne, fournisseur)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des semis : ${error.message}`)

  const seedlings = (data ?? []) as unknown as SeedlingWithRelations[]

  // Charger les plants plantés pour chaque seedling en un seul appel
  const seedlingIds = seedlings.map(s => s.id)

  let plantingsBySeeedling: Record<string, number> = {}
  if (seedlingIds.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('seedling_id, nb_plants')
      .in('seedling_id', seedlingIds)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { seedling_id: string; nb_plants: number | null }[]) {
      if (p.seedling_id) {
        plantingsBySeeedling[p.seedling_id] = (plantingsBySeeedling[p.seedling_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return seedlings.map(s => {
    const plantsPlantes = plantingsBySeeedling[s.id] ?? 0
    const plantsRestants = s.nb_plants_obtenus != null
      ? Math.max(0, s.nb_plants_obtenus - plantsPlantes)
      : null
    return {
      ...s,
      plants_plantes: plantsPlantes,
      plants_restants: plantsRestants,
    }
  })
}

/** Récupère les sachets actifs de la ferme courante pour le sélecteur du formulaire */
export async function fetchSeedLotsForSelect(): Promise<
  { id: string; lot_interne: string; variety_id: string; fournisseur: string | null; numero_lot_fournisseur: string | null; varieties: { nom_vernaculaire: string } | null }[]
> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seed_lots')
    .select('id, lot_interne, variety_id, fournisseur, numero_lot_fournisseur, varieties(nom_vernaculaire)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('lot_interne', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sachets : ${error.message}`)

  return (data ?? []) as { id: string; lot_interne: string; variety_id: string; fournisseur: string | null; numero_lot_fournisseur: string | null; varieties: { nom_vernaculaire: string } | null }[]
}

// ---- Actions ----

/** Crée un nouveau semis */
export async function createSeedling(formData: FormData): Promise<ActionResult<Seedling>> {
  const parsed = parseSeedlingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Calculer le statut initial
  const statut = computeSeedlingStatut(
    {
      processus: parsed.data.processus as 'mini_motte' | 'caissette_godet',
      date_levee: parsed.data.date_levee ?? null,
      date_repiquage: parsed.data.date_repiquage ?? null,
      nb_plants_obtenus: parsed.data.nb_plants_obtenus ?? null,
    },
    0, // pas de plantings à la création
  )

  const { data, error } = await supabase
    .from('seedlings')
    .insert({ ...normalizeMortesFields(parsed.data), statut, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true, data: data as Seedling }
}

/** Met à jour un semis existant.
 *  Le changement de processus est autorisé : les champs de l'ancien processus
 *  sont remis à null par parseSeedlingForm.
 *  Le statut est recalculé automatiquement. */
export async function updateSeedling(
  id: string,
  formData: FormData,
): Promise<ActionResult<Seedling>> {
  const parsed = parseSeedlingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Calculer le nombre de plants plantés pour recalculer le statut
  const plantsPlantes = await getPlantsPlantes(id)

  const statut = computeSeedlingStatut(
    {
      processus: parsed.data.processus as 'mini_motte' | 'caissette_godet',
      date_levee: parsed.data.date_levee ?? null,
      date_repiquage: parsed.data.date_repiquage ?? null,
      nb_plants_obtenus: parsed.data.nb_plants_obtenus ?? null,
    },
    plantsPlantes,
  )

  const { data, error } = await supabase
    .from('seedlings')
    .update({ ...normalizeMortesFields(parsed.data), statut, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true, data: data as Seedling }
}

/** Archive un semis (soft delete) */
export async function archiveSeedling(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('seedlings')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true }
}

/** Restaure un semis archivé */
export async function restoreSeedling(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('seedlings')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  // Recalculer le statut après restauration
  await recalculateSeedlingStatut(id)

  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true }
}
