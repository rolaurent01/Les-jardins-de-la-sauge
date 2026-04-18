import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ReferenceDataResponse } from '@/lib/offline/db'

/**
 * GET /api/offline/reference-data?farmId=xxx
 *
 * Retourne toutes les données de référence en une seule requête
 * pour alimenter le cache IndexedDB côté client.
 *
 * Authentification requise + vérification d'accès à la ferme.
 * Utilise le client admin (service_role) pour les requêtes complexes
 * (filtrage farm_variety_settings, farm_material_settings).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const farmId = request.nextUrl.searchParams.get('farmId')
  if (!farmId) {
    return NextResponse.json({ error: 'farmId requis' }, { status: 400 })
  }

  // Vérifier l'authentification
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Vérifier que l'utilisateur a accès à cette ferme (via membership)
  const { data: farm } = await admin
    .from('farms')
    .select('id, organization_id')
    .eq('id', farmId)
    .single()

  if (!farm) {
    return NextResponse.json({ error: 'Ferme introuvable' }, { status: 404 })
  }

  const { data: membership } = await admin
    .from('memberships')
    .select('id')
    .eq('organization_id', farm.organization_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Accès refusé à cette ferme' }, { status: 403 })
  }

  // Charger toutes les données de référence en parallèle
  const [varieties, sites, parcels, rows, plantings, recipes, seedLots, seedlings, boutures, externalMaterials, stock, dryingInProgress] =
    await Promise.all([
      loadVarieties(admin, farmId),
      loadSites(admin, farmId),
      loadParcels(admin, farmId),
      loadRows(admin, farmId),
      loadPlantings(admin, farmId),
      loadRecipes(admin, farmId),
      loadSeedLots(admin, farmId),
      loadSeedlings(admin, farmId),
      loadCuttings(admin, farmId),
      loadExternalMaterials(admin, farmId),
      loadStock(admin, farmId),
      loadDryingInProgress(admin, farmId),
    ])

  const response: ReferenceDataResponse = {
    varieties,
    sites,
    parcels,
    rows,
    plantings,
    recipes,
    seedLots,
    seedlings,
    boutures,
    externalMaterials,
    stock,
    dryingInProgress,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(response)
}

// --- Fonctions de chargement par table ---

/**
 * Variétés : catalogue partagé, exclusion des masquées/mergées/supprimées.
 * Utilise une sous-requête pour exclure les variétés masquées par cette ferme.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadVarieties(admin: any, farmId: string) {
  // Récupérer les IDs des variétés masquées pour cette ferme
  const { data: hiddenSettings } = await admin
    .from('farm_variety_settings')
    .select('variety_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = (hiddenSettings ?? []).map(
    (s: { variety_id: string }) => s.variety_id
  )

  // Charger les variétés non supprimées, non mergées
  let query = admin
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille, type_cycle, parties_utilisees')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('nom_vernaculaire')

  // Exclure les variétés masquées (si il y en a)
  if (hiddenIds.length > 0) {
    query = query.not('id', 'in', `(${hiddenIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Erreur chargement variétés : ${error.message}`)
  return data ?? []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSites(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('sites')
    .select('id, nom')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('nom')

  if (error) throw new Error(`Erreur chargement sites : ${error.message}`)
  return data ?? []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadParcels(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('parcels')
    .select('id, site_id, nom, code')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('code')

  if (error) throw new Error(`Erreur chargement parcelles : ${error.message}`)
  return data ?? []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRows(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('rows')
    .select('id, parcel_id, numero, longueur_m, largeur_m, position_ordre')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('position_ordre')

  if (error) throw new Error(`Erreur chargement rangs : ${error.message}`)
  return data ?? []
}

/** Plantations actives avec nom de variété — pour enrichir les sélecteurs de rang */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPlantings(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('plantings')
    .select('id, row_id, variety_id, actif, longueur_m, varieties(nom_vernaculaire)')
    .eq('farm_id', farmId)
    .eq('actif', true)
    .is('deleted_at', null)

  if (error) throw new Error(`Erreur chargement plantations : ${error.message}`)

  return (data ?? []).map((p: { id: string; row_id: string; variety_id: string; actif: boolean; longueur_m: number | null; varieties: { nom_vernaculaire: string } | null }) => ({
    id: p.id,
    row_id: p.row_id,
    variety_id: p.variety_id,
    variety_name: p.varieties?.nom_vernaculaire ?? '',
    actif: p.actif,
    longueur_m: (p.longueur_m as number | null) ?? null,
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRecipes(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('recipes')
    .select('id, nom, category_id, poids_sachet_g, actif')
    .eq('farm_id', farmId)
    .eq('actif', true)
    .is('deleted_at', null)
    .order('nom')

  if (error) throw new Error(`Erreur chargement recettes : ${error.message}`)
  return data ?? []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSeedLots(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('seed_lots')
    .select('id, lot_interne, variety_id, fournisseur, numero_lot_fournisseur, date_achat, poids_sachet_g, certif_ab')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_achat', { ascending: false })

  if (error) throw new Error(`Erreur chargement sachets de graines : ${error.message}`)

  // Enrichir avec le stock restant depuis v_seed_stock
  const { data: stockData } = await admin
    .from('v_seed_stock')
    .select('seed_lot_id, stock_g')
    .eq('farm_id', farmId)

  const stockMap = new Map<string, number>()
  for (const s of (stockData ?? []) as { seed_lot_id: string; stock_g: number }[]) {
    stockMap.set(s.seed_lot_id, s.stock_g)
  }

  return (data ?? []).map((sl: { id: string }) => ({
    ...sl,
    stock_g: stockMap.get(sl.id) ?? null,
  }))
}

/**
 * Semis enrichis avec plants_restants pour le sélecteur plantation mobile.
 * Ne charge que les semis non-supprimés ayant des plants obtenus (pret, en_plantation).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSeedlings(admin: any, farmId: string) {
  const { data: seedlings, error } = await admin
    .from('seedlings')
    .select('id, processus, statut, numero_caisse, nb_plants_obtenus, date_semis, variety_id, seed_lot_id, varieties(nom_vernaculaire), seed_lots(lot_interne)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_semis', { ascending: false })

  if (error) throw new Error(`Erreur chargement semis : ${error.message}`)

  const seedlingRows = (seedlings ?? []) as Array<{
    id: string; processus: string; statut: string; numero_caisse: string | null
    nb_plants_obtenus: number | null; date_semis: string; variety_id: string | null
    seed_lot_id: string | null
    varieties: { nom_vernaculaire: string } | null
    seed_lots: { lot_interne: string } | null
  }>

  // Charger les plants plantés en batch
  const ids = seedlingRows.map(s => s.id)
  let plantingsBySeeedling: Record<string, number> = {}

  if (ids.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('seedling_id, nb_plants')
      .in('seedling_id', ids)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { seedling_id: string; nb_plants: number | null }[]) {
      if (p.seedling_id) {
        plantingsBySeeedling[p.seedling_id] = (plantingsBySeeedling[p.seedling_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return seedlingRows.map(s => {
    const plantsPlantes = plantingsBySeeedling[s.id] ?? 0
    const plantsRestants = s.nb_plants_obtenus != null
      ? Math.max(0, s.nb_plants_obtenus - plantsPlantes)
      : null
    return {
      id: s.id,
      processus: s.processus,
      statut: s.statut,
      numero_caisse: s.numero_caisse,
      nb_plants_obtenus: s.nb_plants_obtenus,
      date_semis: s.date_semis,
      variety_id: s.variety_id,
      variety_name: s.varieties?.nom_vernaculaire ?? null,
      seed_lot_id: s.seed_lot_id,
      seed_lot_interne: s.seed_lots?.lot_interne ?? null,
      plants_plantes: plantsPlantes,
      plants_restants: plantsRestants,
    }
  })
}

/**
 * Boutures enrichies avec plants_restants.
 */
async function loadCuttings(admin: any, farmId: string) {
  const { data: cuttingsData, error } = await admin
    .from('boutures')
    .select('id, type_multiplication, statut, nb_plants_obtenus, date_bouturage, variety_id, origine, varieties(nom_vernaculaire)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_bouturage', { ascending: false })

  if (error) throw new Error(`Erreur chargement boutures : ${error.message}`)

  const rows = (cuttingsData ?? []) as Array<{
    id: string; type_multiplication: string; statut: string
    nb_plants_obtenus: number | null; date_bouturage: string
    variety_id: string | null; origine: string | null
    varieties: { nom_vernaculaire: string } | null
  }>

  // Charger les plants plantés en batch
  const ids = rows.map(c => c.id)
  let plantingsByCutting: Record<string, number> = {}

  if (ids.length > 0) {
    const { data: plantings } = await admin
      .from('plantings')
      .select('bouture_id, nb_plants')
      .in('bouture_id', ids)
      .eq('actif', true)
      .is('deleted_at', null)

    for (const p of (plantings ?? []) as { bouture_id: string; nb_plants: number | null }[]) {
      if (p.bouture_id) {
        plantingsByCutting[p.bouture_id] = (plantingsByCutting[p.bouture_id] ?? 0) + (p.nb_plants ?? 0)
      }
    }
  }

  return rows.map(c => {
    const plantsPlantes = plantingsByCutting[c.id] ?? 0
    const plantsRestants = c.nb_plants_obtenus != null
      ? Math.max(0, c.nb_plants_obtenus - plantsPlantes)
      : null
    return {
      id: c.id,
      type_multiplication: c.type_multiplication,
      statut: c.statut,
      nb_plants_obtenus: c.nb_plants_obtenus,
      date_bouturage: c.date_bouturage,
      variety_id: c.variety_id,
      variety_name: c.varieties?.nom_vernaculaire ?? null,
      origine: c.origine,
      plants_plantes: plantsPlantes,
      plants_restants: plantsRestants,
    }
  })
}

/**
 * Matériaux externes : catalogue partagé, exclusion des masqués et supprimés.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadExternalMaterials(admin: any, farmId: string) {
  // Récupérer les IDs masqués pour cette ferme
  const { data: hiddenSettings } = await admin
    .from('farm_material_settings')
    .select('external_material_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = (hiddenSettings ?? []).map(
    (s: { external_material_id: string }) => s.external_material_id
  )

  let query = admin
    .from('external_materials')
    .select('id, nom, unite')
    .is('deleted_at', null)
    .order('nom')

  if (hiddenIds.length > 0) {
    query = query.not('id', 'in', `(${hiddenIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Erreur chargement matériaux : ${error.message}`)
  return data ?? []
}

/**
 * Stock agrégé depuis v_stock — snapshot pour le cache offline.
 * Génère un id composite pour la clé primaire Dexie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadStock(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('v_stock')
    .select('variety_id, partie_plante, etat_plante, stock_g')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur chargement stock : ${error.message}`)

  return (data ?? []).map((row: { variety_id: string; partie_plante: string; etat_plante: string; stock_g: number }) => ({
    id: `${row.variety_id}_${row.partie_plante}_${row.etat_plante}`,
    variety_id: row.variety_id,
    partie_plante: row.partie_plante,
    etat_plante: row.etat_plante,
    stock_g: Number(row.stock_g),
  }))
}

/**
 * Séchage en cours : entrées séchage non encore sorties,
 * agrégé par variété × partie × état d'entrée.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadDryingInProgress(admin: any, farmId: string) {
  const { data, error } = await admin
    .from('dryings')
    .select('variety_id, partie_plante, etat_plante, type, poids_g')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur chargement séchage en cours : ${error.message}`)
  if (!data || data.length === 0) return []

  /** Mapping sortie → entrée pour normaliser les états */
  const sortieToEntree: Record<string, string> = {
    sechee: 'frais',
    tronconnee_sechee: 'tronconnee',
  }

  // Agréger par (variety_id, partie_plante, etat_entree)
  const map = new Map<string, number>()
  for (const d of data as { variety_id: string; partie_plante: string; etat_plante: string; type: string; poids_g: number }[]) {
    const etatEntree = d.type === 'entree'
      ? d.etat_plante
      : (sortieToEntree[d.etat_plante] ?? d.etat_plante)

    const key = `${d.variety_id}::${d.partie_plante}::${etatEntree}`
    const current = map.get(key) ?? 0
    const delta = d.type === 'entree' ? Number(d.poids_g) : -Number(d.poids_g)
    map.set(key, current + delta)
  }

  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, enSechageG]) => {
      const [variety_id, partie_plante, etat_plante_entree] = key.split('::')
      return {
        id: `${variety_id}_${partie_plante}_${etat_plante_entree}_drying`,
        variety_id,
        partie_plante,
        etat_plante_entree,
        en_sechage_g: Math.round(enSechageG * 100) / 100,
      }
    })
}
