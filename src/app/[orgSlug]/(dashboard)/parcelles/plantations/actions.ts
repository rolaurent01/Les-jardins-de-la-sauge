'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parsePlantingForm } from '@/lib/utils/parcelles-parsers'
import { recalculateSeedlingStatut } from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import type { ActionResult, Planting, PlantingWithRelations, Seedling, Variety } from '@/lib/types'

// ---- Types locaux ----

/** Semis enrichi avec plants_restants pour le sélecteur */
export type SeedlingForSelect = Pick<Seedling, 'id' | 'processus' | 'statut' | 'numero_caisse' | 'nb_plants_obtenus' | 'date_semis'> & {
  variety_id: string | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
  seed_lots: { id: string; lot_interne: string; fournisseur: string | null } | null
  plants_plantes: number
  plants_restants: number | null
}

/** Avertissements associés à un rang avant plantation */
export type RowWarnings = {
  /** Plantations actives existantes sur ce rang */
  activePlantings: {
    variety_name: string
    date_plantation: string
    longueur_m: number | null
  }[]
  /** Somme des longueur_m des plantings actifs */
  totalLongueurUsed: number
  /** Longueur du rang en mètres */
  rowLongueur: number | null
  /** Largeur du rang en mètres */
  rowLargeur: number | null
  /** Occultation sans date_fin (rang couvert) */
  activeOccultation: { date_debut: string; methode: string } | null
}

// ---- Requêtes ----

/** Récupère toutes les plantations actives de la ferme courante avec variété, rang et semis joints */
export async function fetchPlantings(): Promise<PlantingWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('plantings')
    .select(
      '*, varieties(id, nom_vernaculaire), rows(id, numero, longueur_m, largeur_m, parcels(id, nom, code, sites(id, nom))), seedlings(id, processus, statut, numero_caisse)',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_plantation', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des plantations : ${error.message}`)

  return (data ?? []) as unknown as PlantingWithRelations[]
}

/** Récupère les semis enrichis avec plants_restants pour le sélecteur du formulaire plantation */
export async function fetchSeedlingsForSelect(): Promise<SeedlingForSelect[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seedlings')
    .select('id, processus, statut, numero_caisse, nb_plants_obtenus, date_semis, variety_id, varieties(id, nom_vernaculaire), seed_lots(id, lot_interne, fournisseur)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des semis : ${error.message}`)

  const seedlings = (data ?? []) as unknown as (Pick<Seedling, 'id' | 'processus' | 'statut' | 'numero_caisse' | 'nb_plants_obtenus' | 'date_semis'> & {
    variety_id: string | null
    varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
    seed_lots: { id: string; lot_interne: string; fournisseur: string | null } | null
  })[]

  // Charger les plants plantés en un seul appel
  const seedlingIds = seedlings.map(s => s.id)
  let plantingsBySeedling: Record<string, number> = {}

  if (seedlingIds.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('seedling_id, nb_plants')
      .in('seedling_id', seedlingIds)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { seedling_id: string; nb_plants: number | null }[]) {
      if (p.seedling_id) {
        plantingsBySeedling[p.seedling_id] = (plantingsBySeedling[p.seedling_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return seedlings.map(s => {
    const plantsPlantes = plantingsBySeedling[s.id] ?? 0
    const plantsRestants = s.nb_plants_obtenus != null
      ? Math.max(0, s.nb_plants_obtenus - plantsPlantes)
      : null
    return { ...s, plants_plantes: plantsPlantes, plants_restants: plantsRestants }
  })
}

/**
 * Retourne les avertissements pour un rang donné.
 */
export async function fetchRowWarnings(rowId: string): Promise<RowWarnings> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  type PlantingRow = {
    longueur_m: number | null
    date_plantation: string
    varieties: { nom_vernaculaire: string } | null
  }

  const { data: rawPlantings, error: plantingsError } = await supabase
    .from('plantings')
    .select('longueur_m, date_plantation, varieties(nom_vernaculaire)')
    .eq('farm_id', farmId)
    .eq('row_id', rowId)
    .eq('actif', true)
    .is('deleted_at', null)

  if (plantingsError) throw new Error(`Erreur plantings : ${plantingsError.message}`)
  const plantingsData = (rawPlantings ?? []) as unknown as PlantingRow[]

  const { data: occultationData, error: occultationError } = await supabase
    .from('occultations')
    .select('date_debut, methode')
    .eq('farm_id', farmId)
    .eq('row_id', rowId)
    .is('date_fin', null)
    .order('date_debut', { ascending: false })
    .limit(1)

  if (occultationError) throw new Error(`Erreur occultations : ${occultationError.message}`)

  const { data: rowData, error: rowError } = await supabase
    .from('rows')
    .select('longueur_m, largeur_m')
    .eq('id', rowId)
    .single()

  if (rowError) throw new Error(`Erreur rang : ${rowError.message}`)

  const activePlantings = plantingsData.map((p) => ({
    variety_name: p.varieties?.nom_vernaculaire ?? 'Variété inconnue',
    date_plantation: p.date_plantation,
    longueur_m: p.longueur_m,
  }))

  const totalLongueurUsed = activePlantings.reduce(
    (sum, p) => sum + (p.longueur_m ?? 0),
    0,
  )

  const occultation = occultationData?.[0] ?? null

  return {
    activePlantings,
    totalLongueurUsed,
    rowLongueur: (rowData?.longueur_m as number | null) ?? null,
    rowLargeur: (rowData?.largeur_m as number | null) ?? null,
    activeOccultation: occultation
      ? { date_debut: occultation.date_debut as string, methode: occultation.methode as string }
      : null,
  }
}

// ---- Actions ----

/**
 * Crée une nouvelle plantation.
 * Valide plants_restants si seedling_id est fourni.
 * Met à jour le statut du seedling après création.
 */
export async function createPlanting(formData: FormData): Promise<ActionResult<Planting>> {
  const parsed = parsePlantingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, farmId, orgSlug } = await getContext()

  const seedlingId = parsed.data.seedling_id as string | null

  // Validation plants_restants si on plante depuis un semis
  if (seedlingId && parsed.data.nb_plants != null) {
    const { data: seedling } = await admin
      .from('seedlings')
      .select('nb_plants_obtenus')
      .eq('id', seedlingId)
      .single()

    if (seedling?.nb_plants_obtenus != null) {
      // Calculer les plants déjà plantés
      const { data: existingPlantings } = await admin
        .from('plantings')
        .select('nb_plants')
        .eq('seedling_id', seedlingId)
        .eq('actif', true)
        .is('deleted_at', null)

      const alreadyPlanted = (existingPlantings ?? []).reduce(
        (sum, p) => sum + ((p.nb_plants as number) ?? 0), 0,
      )
      const plantsRestants = seedling.nb_plants_obtenus - alreadyPlanted

      if (parsed.data.nb_plants > plantsRestants) {
        return { error: `Ce semis n'a que ${plantsRestants} plant${plantsRestants > 1 ? 's' : ''} disponible${plantsRestants > 1 ? 's' : ''}.` }
      }
    }
  }

  // Pré-remplissage des dimensions depuis le rang si l'utilisateur n'a pas saisi
  let { longueur_m, largeur_m } = parsed.data
  if (longueur_m === null || largeur_m === null) {
    const { data: rowData } = await supabase
      .from('rows')
      .select('longueur_m, largeur_m')
      .eq('id', parsed.data.row_id)
      .single()

    if (rowData) {
      if (longueur_m === null) longueur_m = (rowData.longueur_m as number | null) ?? null
      if (largeur_m === null) largeur_m = (rowData.largeur_m as number | null) ?? null
    }
  }

  const { data, error } = await supabase
    .from('plantings')
    .insert({ ...parsed.data, longueur_m, largeur_m, actif: true, farm_id: farmId, created_by: userId })
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  // Mettre à jour le statut du seedling si on a planté depuis un semis
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true, data: data as Planting }
}

/** Met à jour une plantation existante (ne modifie pas actif — géré par arrachage) */
export async function updatePlanting(
  id: string,
  formData: FormData,
): Promise<ActionResult<Planting>> {
  const parsed = parsePlantingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, orgSlug } = await getContext()

  // Récupérer l'ancien seedling_id pour recalculer son statut si nécessaire
  const { data: oldPlanting } = await admin
    .from('plantings')
    .select('seedling_id, nb_plants')
    .eq('id', id)
    .single()

  const newSeedlingId = parsed.data.seedling_id as string | null

  // Validation plants_restants pour le nouveau seedling
  if (newSeedlingId && parsed.data.nb_plants != null) {
    const { data: seedling } = await admin
      .from('seedlings')
      .select('nb_plants_obtenus')
      .eq('id', newSeedlingId)
      .single()

    if (seedling?.nb_plants_obtenus != null) {
      const { data: existingPlantings } = await admin
        .from('plantings')
        .select('id, nb_plants')
        .eq('seedling_id', newSeedlingId)
        .eq('actif', true)
        .is('deleted_at', null)

      // Exclure la plantation en cours d'édition du total
      const alreadyPlanted = (existingPlantings ?? [])
        .filter(p => (p.id as string) !== id)
        .reduce((sum, p) => sum + ((p.nb_plants as number) ?? 0), 0)
      const plantsRestants = seedling.nb_plants_obtenus - alreadyPlanted

      if (parsed.data.nb_plants > plantsRestants) {
        return { error: `Ce semis n'a que ${plantsRestants} plant${plantsRestants > 1 ? 's' : ''} disponible${plantsRestants > 1 ? 's' : ''}.` }
      }
    }
  }

  const { data, error } = await supabase
    .from('plantings')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  // Recalculer le statut de l'ancien seedling si changé
  const oldSeedlingId = (oldPlanting?.seedling_id as string | null) ?? null
  if (oldSeedlingId && oldSeedlingId !== newSeedlingId) {
    await recalculateSeedlingStatut(oldSeedlingId)
  }
  // Recalculer le statut du nouveau seedling
  if (newSeedlingId) {
    await recalculateSeedlingStatut(newSeedlingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true, data: data as Planting }
}

/** Soft delete d'une plantation */
export async function archivePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, orgSlug } = await getContext()

  // Récupérer le seedling_id avant l'archivage
  const { data: planting } = await admin
    .from('plantings')
    .select('seedling_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  // Recalculer le statut du seedling lié
  const seedlingId = (planting?.seedling_id as string | null) ?? null
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true }
}

/** Restaure une plantation archivée */
export async function restorePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, orgSlug } = await getContext()

  // Récupérer le seedling_id
  const { data: planting } = await admin
    .from('plantings')
    .select('seedling_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  // Recalculer le statut du seedling lié
  const seedlingId = (planting?.seedling_id as string | null) ?? null
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  return { success: true }
}
