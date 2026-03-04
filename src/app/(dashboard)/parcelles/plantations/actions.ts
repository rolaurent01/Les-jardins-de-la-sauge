'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parsePlantingForm } from '@/lib/utils/parcelles-parsers'
import type { ActionResult, Planting, PlantingWithRelations, Seedling, Variety } from '@/lib/types'

const REVALIDATE_PATH = '/parcelles/plantations'

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

/** Récupère toutes les plantations actives avec variété, rang (parcelle + site) et semis joints */
export async function fetchPlantings(): Promise<PlantingWithRelations[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plantings')
    .select(
      '*, varieties(id, nom_vernaculaire), rows(id, numero, longueur_m, largeur_m, parcels(id, nom, code, sites(id, nom))), seedlings(id, processus)',
    )
    .is('deleted_at', null)
    .order('date_plantation', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des plantations : ${error.message}`)

  return (data ?? []) as PlantingWithRelations[]
}

/** Récupère les semis actifs pour le dropdown "Semis d'origine" */
export async function fetchSeedlingsForSelect(): Promise<SeedlingForSelect[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seedlings')
    .select('id, processus, numero_caisse, nb_plants_obtenus, varieties(id, nom_vernaculaire)')
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des semis : ${error.message}`)

  return (data ?? []) as SeedlingForSelect[]
}

/**
 * Retourne les avertissements pour un rang donné.
 * Appelée depuis le client lors de la sélection d'un rang dans le formulaire.
 */
export async function fetchRowWarnings(rowId: string): Promise<RowWarnings> {
  const supabase = await createClient()

  type PlantingRow = {
    longueur_m: number | null
    date_plantation: string
    varieties: { nom_vernaculaire: string } | null
  }

  // Requête 1 : plantings actifs sur ce rang avec variété
  const { data: rawPlantings, error: plantingsError } = await supabase
    .from('plantings')
    .select('longueur_m, date_plantation, varieties(nom_vernaculaire)')
    .eq('row_id', rowId)
    .eq('actif', true)
    .is('deleted_at', null)

  if (plantingsError) throw new Error(`Erreur plantings : ${plantingsError.message}`)
  const plantingsData = (rawPlantings ?? []) as unknown as PlantingRow[]

  // Requête 2 : occultation sans date_fin (rang encore couvert)
  const { data: occultationData, error: occultationError } = await supabase
    .from('occultations')
    .select('date_debut, methode')
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
    .insert({ ...parsed.data, longueur_m, largeur_m, actif: true })
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
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

  const { data, error } = await supabase
    .from('plantings')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as Planting }
}

/** Soft delete d'une plantation */
export async function archivePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

/** Restaure une plantation archivée */
export async function restorePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
