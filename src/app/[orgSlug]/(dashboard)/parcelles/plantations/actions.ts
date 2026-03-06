'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parsePlantingForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, Planting, PlantingWithRelations, Seedling, Variety } from '@/lib/types'

// ---- Types locaux ----

/** Semis avec variété jointure pour les dropdowns */
export type SeedlingForSelect = Pick<Seedling, 'id' | 'processus' | 'numero_caisse' | 'nb_plants_obtenus'> & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
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
      '*, varieties(id, nom_vernaculaire), rows(id, numero, longueur_m, largeur_m, parcels(id, nom, code, sites(id, nom))), seedlings(id, processus)',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_plantation', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des plantations : ${error.message}`)

  return (data ?? []) as PlantingWithRelations[]
}

/** Récupère les semis actifs de la ferme courante pour le dropdown "Semis d'origine" */
export async function fetchSeedlingsForSelect(): Promise<SeedlingForSelect[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('seedlings')
    .select('id, processus, numero_caisse, nb_plants_obtenus, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des semis : ${error.message}`)

  return (data ?? []) as SeedlingForSelect[]
}

/**
 * Retourne les avertissements pour un rang donné.
 * Les RLS filtrent automatiquement par farm_id — défense en profondeur maintenue
 * par la vérification du contexte au niveau de la session.
 */
export async function fetchRowWarnings(rowId: string): Promise<RowWarnings> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  type PlantingRow = {
    longueur_m: number | null
    date_plantation: string
    varieties: { nom_vernaculaire: string } | null
  }

  // Requête 1 : plantings actifs sur ce rang avec variété
  const { data: rawPlantings, error: plantingsError } = await supabase
    .from('plantings')
    .select('longueur_m, date_plantation, varieties(nom_vernaculaire)')
    .eq('farm_id', farmId)
    .eq('row_id', rowId)
    .eq('actif', true)
    .is('deleted_at', null)

  if (plantingsError) throw new Error(`Erreur plantings : ${plantingsError.message}`)
  const plantingsData = (rawPlantings ?? []) as unknown as PlantingRow[]

  // Requête 2 : occultation sans date_fin (rang encore couvert)
  const { data: occultationData, error: occultationError } = await supabase
    .from('occultations')
    .select('date_debut, methode')
    .eq('farm_id', farmId)
    .eq('row_id', rowId)
    .is('date_fin', null)
    .order('date_debut', { ascending: false })
    .limit(1)

  if (occultationError) throw new Error(`Erreur occultations : ${occultationError.message}`)

  // Requête 3 : longueur et largeur du rang
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
 * Pré-remplit longueur_m et largeur_m depuis le rang si non saisis.
 */
export async function createPlanting(formData: FormData): Promise<ActionResult<Planting>> {
  const parsed = parsePlantingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

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

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
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
  const { userId, orgSlug } = await getContext()

  const { data, error } = await supabase
    .from('plantings')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  return { success: true, data: data as Planting }
}

/** Soft delete d'une plantation */
export async function archivePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  return { success: true }
}

/** Restaure une plantation archivée */
export async function restorePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  return { success: true }
}
