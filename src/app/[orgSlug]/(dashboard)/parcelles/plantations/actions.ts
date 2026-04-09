'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parsePlantingForm } from '@/lib/utils/parcelles-parsers'
import { recalculateSeedlingStatut } from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import { recalculateCuttingStatut } from '@/app/[orgSlug]/(dashboard)/semis/boutures/actions'
import type { ActionResult, Bouture, Planting, PlantingWithRelations, Seedling, Variety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Types locaux ----

/** Semis enrichi avec plants_restants pour le sélecteur */
export type SeedlingForSelect = Pick<Seedling, 'id' | 'processus' | 'statut' | 'numero_caisse' | 'nb_plants_obtenus' | 'date_semis'> & {
  variety_id: string | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
  seed_lots: { id: string; lot_interne: string; fournisseur: string | null } | null
  plants_plantes: number
  plants_restants: number | null
}

/** Bouture enrichie avec plants_restants pour le sélecteur */
export type CuttingForSelect = Pick<Bouture, 'id' | 'type_multiplication' | 'statut' | 'nb_plants_obtenus' | 'date_bouturage'> & {
  variety_id: string | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
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

/** Sachet de graines enrichi avec stock pour le sélecteur du formulaire plantation */
export type SeedLotForSelect = {
  id: string
  lot_interne: string
  variety_id: string | null
  fournisseur: string | null
  poids_sachet_g: number | null
  certif_ab: boolean
  stock_g: number | null
}

// ---- Requêtes ----

/** Récupère toutes les plantations actives de la ferme courante avec variété, rang et semis joints */
export async function fetchPlantings(): Promise<PlantingWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('plantings')
    .select(
      '*, varieties(id, nom_vernaculaire), rows(id, numero, longueur_m, largeur_m, parcels(id, nom, code, sites(id, nom))), seedlings(id, processus, statut, numero_caisse), boutures(id, type_multiplication, statut), seed_lots(id, lot_interne, fournisseur)',
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

/** Récupère les boutures enrichies avec plants_restants pour le sélecteur du formulaire plantation */
export async function fetchCuttingsForSelect(): Promise<CuttingForSelect[]> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('boutures')
    .select('id, type_multiplication, statut, nb_plants_obtenus, date_bouturage, variety_id, varieties(id, nom_vernaculaire)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_bouturage', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des boutures : ${error.message}`)

  const cuttings = (data ?? []) as unknown as (Pick<Bouture, 'id' | 'type_multiplication' | 'statut' | 'nb_plants_obtenus' | 'date_bouturage'> & {
    variety_id: string | null
    varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
  })[]

  const cuttingIds = cuttings.map(c => c.id)
  let plantingsByCutting: Record<string, number> = {}

  if (cuttingIds.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('bouture_id, nb_plants')
      .in('bouture_id', cuttingIds)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { bouture_id: string; nb_plants: number | null }[]) {
      if (p.bouture_id) {
        plantingsByCutting[p.bouture_id] = (plantingsByCutting[p.bouture_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return cuttings.map(c => {
    const plantsPlantes = plantingsByCutting[c.id] ?? 0
    const plantsRestants = c.nb_plants_obtenus != null
      ? Math.max(0, c.nb_plants_obtenus - plantsPlantes)
      : null
    return { ...c, plants_plantes: plantsPlantes, plants_restants: plantsRestants }
  })
}

/** Récupère les sachets de graines avec stock pour le sélecteur du formulaire plantation */
export async function fetchSeedLotsForSelect(): Promise<SeedLotForSelect[]> {
  const admin = createAdminClient()
  const { farmId } = await getContext()

  const { data, error } = await admin
    .from('seed_lots')
    .select('id, lot_interne, variety_id, fournisseur, poids_sachet_g, certif_ab')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('lot_interne', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sachets : ${error.message}`)

  // Enrichir avec le stock restant
  const { data: stockData } = await admin
    .from('v_seed_stock')
    .select('seed_lot_id, stock_g')
    .eq('farm_id', farmId)

  const stockMap = new Map<string, number>()
  for (const s of (stockData ?? []) as { seed_lot_id: string; stock_g: number }[]) {
    stockMap.set(s.seed_lot_id, s.stock_g)
  }

  return (data ?? []).map(sl => ({
    ...sl,
    variety_id: (sl.variety_id as string | null) ?? null,
    fournisseur: (sl.fournisseur as string | null) ?? null,
    poids_sachet_g: (sl.poids_sachet_g as number | null) ?? null,
    certif_ab: (sl.certif_ab as boolean) ?? false,
    stock_g: stockMap.get(sl.id as string) ?? null,
  })) as SeedLotForSelect[]
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
  const cuttingId = parsed.data.bouture_id as string | null

  // Validation plants_restants si on plante depuis un semis
  if (seedlingId && parsed.data.nb_plants != null) {
    const { data: seedling } = await admin
      .from('seedlings')
      .select('nb_plants_obtenus')
      .eq('id', seedlingId)
      .single()

    if (seedling?.nb_plants_obtenus != null) {
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

  // Validation plants_restants si on plante depuis une bouture
  if (cuttingId && parsed.data.nb_plants != null) {
    const { data: cutting } = await admin
      .from('boutures')
      .select('nb_plants_obtenus')
      .eq('id', cuttingId)
      .single()

    if (cutting?.nb_plants_obtenus != null) {
      const { data: existingPlantings } = await admin
        .from('plantings')
        .select('nb_plants')
        .eq('bouture_id', cuttingId)
        .eq('actif', true)
        .is('deleted_at', null)

      const alreadyPlanted = (existingPlantings ?? []).reduce(
        (sum, p) => sum + ((p.nb_plants as number) ?? 0), 0,
      )
      const plantsRestants = cutting.nb_plants_obtenus - alreadyPlanted

      if (parsed.data.nb_plants > plantsRestants) {
        return { error: `Cette bouture n'a que ${plantsRestants} plant${plantsRestants > 1 ? 's' : ''} disponible${plantsRestants > 1 ? 's' : ''}.` }
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

  if (error) return { error: mapSupabaseError(error) }

  // Mettre à jour le statut du seedling/cutting si on a planté depuis un semis ou une bouture
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }
  if (cuttingId) {
    await recalculateCuttingStatut(cuttingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
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
  const { userId, farmId, orgSlug } = await getContext()

  // Récupérer l'ancien seedling_id/bouture_id pour recalculer le statut si nécessaire
  const { data: oldPlanting } = await admin
    .from('plantings')
    .select('seedling_id, bouture_id, nb_plants')
    .eq('id', id)
    .single()

  const newSeedlingId = parsed.data.seedling_id as string | null
  const newCuttingId = parsed.data.bouture_id as string | null

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

      const alreadyPlanted = (existingPlantings ?? [])
        .filter(p => (p.id as string) !== id)
        .reduce((sum, p) => sum + ((p.nb_plants as number) ?? 0), 0)
      const plantsRestants = seedling.nb_plants_obtenus - alreadyPlanted

      if (parsed.data.nb_plants > plantsRestants) {
        return { error: `Ce semis n'a que ${plantsRestants} plant${plantsRestants > 1 ? 's' : ''} disponible${plantsRestants > 1 ? 's' : ''}.` }
      }
    }
  }

  // Validation plants_restants pour la nouvelle bouture
  if (newCuttingId && parsed.data.nb_plants != null) {
    const { data: cutting } = await admin
      .from('boutures')
      .select('nb_plants_obtenus')
      .eq('id', newCuttingId)
      .single()

    if (cutting?.nb_plants_obtenus != null) {
      const { data: existingPlantings } = await admin
        .from('plantings')
        .select('id, nb_plants')
        .eq('bouture_id', newCuttingId)
        .eq('actif', true)
        .is('deleted_at', null)

      const alreadyPlanted = (existingPlantings ?? [])
        .filter(p => (p.id as string) !== id)
        .reduce((sum, p) => sum + ((p.nb_plants as number) ?? 0), 0)
      const plantsRestants = cutting.nb_plants_obtenus - alreadyPlanted

      if (parsed.data.nb_plants > plantsRestants) {
        return { error: `Cette bouture n'a que ${plantsRestants} plant${plantsRestants > 1 ? 's' : ''} disponible${plantsRestants > 1 ? 's' : ''}.` }
      }
    }
  }

  const { data, error } = await supabase
    .from('plantings')
    .update({ ...parsed.data, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error) }

  // Recalculer le statut de l'ancien seedling si changé
  const oldSeedlingId = (oldPlanting?.seedling_id as string | null) ?? null
  if (oldSeedlingId && oldSeedlingId !== newSeedlingId) {
    await recalculateSeedlingStatut(oldSeedlingId)
  }
  if (newSeedlingId) {
    await recalculateSeedlingStatut(newSeedlingId)
  }

  // Recalculer le statut de l'ancienne bouture si changée
  const oldCuttingId = (oldPlanting?.bouture_id as string | null) ?? null
  if (oldCuttingId && oldCuttingId !== newCuttingId) {
    await recalculateCuttingStatut(oldCuttingId)
  }
  if (newCuttingId) {
    await recalculateCuttingStatut(newCuttingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true, data: data as Planting }
}

/** Soft delete d'une plantation */
export async function archivePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Récupérer le seedling_id/bouture_id avant l'archivage
  const { data: planting } = await admin
    .from('plantings')
    .select('seedling_id, bouture_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  // Recalculer le statut du seedling/cutting lié
  const seedlingId = (planting?.seedling_id as string | null) ?? null
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }
  const cuttingId = (planting?.bouture_id as string | null) ?? null
  if (cuttingId) {
    await recalculateCuttingStatut(cuttingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true }
}

/** Restaure une plantation archivée */
export async function restorePlanting(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Récupérer le seedling_id/bouture_id
  const { data: planting } = await admin
    .from('plantings')
    .select('seedling_id, bouture_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('plantings')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  // Recalculer le statut du seedling/cutting lié
  const seedlingId = (planting?.seedling_id as string | null) ?? null
  if (seedlingId) {
    await recalculateSeedlingStatut(seedlingId)
  }
  const cuttingId = (planting?.bouture_id as string | null) ?? null
  if (cuttingId) {
    await recalculateCuttingStatut(cuttingId)
  }

  revalidatePath(buildPath(orgSlug, '/parcelles/plantations'))
  revalidatePath(buildPath(orgSlug, '/semis/suivi'))
  revalidatePath(buildPath(orgSlug, '/semis/boutures'))
  return { success: true }
}
