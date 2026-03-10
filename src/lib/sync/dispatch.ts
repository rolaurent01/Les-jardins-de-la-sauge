import { createAdminClient } from '@/lib/supabase/server'
import { generateSeedLotNumber } from '@/lib/utils/lots'
import type { SyncTable } from '@/lib/validation/sync'

/** Résultat d'un dispatch de sync réussi */
type DispatchResult = { server_id: string }

/** Paramètres du dispatch */
type DispatchParams = {
  table_cible: SyncTable
  farm_id: string
  user_id: string
  uuid_client: string
  payload: Record<string, unknown>
}

/**
 * Dispatche une saisie mobile vers la bonne table/RPC Supabase.
 * Gère l'idempotence via uuid_client (ON CONFLICT DO NOTHING côté SQL).
 *
 * @throws Error avec message explicite en cas d'échec
 */
export async function dispatchSyncEntry(params: DispatchParams): Promise<DispatchResult> {
  const { table_cible } = params

  // Tables avec RPC transactionnelle (mouvements de stock atomiques)
  switch (table_cible) {
    case 'harvests':
      return dispatchHarvest(params)
    case 'cuttings':
      return dispatchCutting(params)
    case 'dryings':
      return dispatchDrying(params)
    case 'sortings':
      return dispatchSorting(params)
    case 'stock_purchases':
      return dispatchPurchase(params)
    case 'stock_direct_sales':
      return dispatchDirectSale(params)
    case 'stock_adjustments':
      return dispatchAdjustment(params)
    case 'production_lots':
      return dispatchProductionLot(params)

    // Tables avec INSERT direct
    case 'seed_lots':
      return dispatchSeedLot(params)
    case 'seedlings':
      return dispatchSeedling(params)
    case 'soil_works':
      return dispatchSimpleInsert('soil_works', params)
    case 'plantings':
      return dispatchPlanting(params)
    case 'row_care':
      return dispatchSimpleInsert('row_care', params)
    case 'uprootings':
      return dispatchUprooting(params)
    case 'occultations':
      return dispatchSimpleInsert('occultations', params)
  }
}

// ─────────────────────────────────────────────────────────────
// Tables avec RPC transactionnelle
// ─────────────────────────────────────────────────────────────

async function dispatchHarvest({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_harvest_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_type_cueillette: payload.type_cueillette as string,
    p_row_id: (payload.row_id as string) ?? null,
    p_lieu_sauvage: (payload.lieu_sauvage as string) ?? null,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_date: payload.date as string,
    p_poids_g: payload.poids_g as number,
    p_temps_min: (payload.temps_min as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchCutting({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_cutting_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_type: payload.type as string,
    p_date: payload.date as string,
    p_poids_g: payload.poids_g as number,
    p_temps_min: (payload.temps_min as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchDrying({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_drying_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_type: payload.type as string,
    p_etat_plante: payload.etat_plante as string,
    p_date: payload.date as string,
    p_poids_g: payload.poids_g as number,
    p_temps_min: (payload.temps_min as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchSorting({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_sorting_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_type: payload.type as string,
    p_etat_plante: payload.etat_plante as string,
    p_date: payload.date as string,
    p_poids_g: payload.poids_g as number,
    p_temps_min: (payload.temps_min as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchPurchase({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_purchase_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_date: payload.date as string,
    p_etat_plante: payload.etat_plante as string,
    p_poids_g: payload.poids_g as number,
    p_fournisseur: payload.fournisseur as string,
    p_numero_lot_fournisseur: (payload.numero_lot_fournisseur as string) ?? null,
    p_certif_ab: payload.certif_ab as boolean,
    p_prix: (payload.prix as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchDirectSale({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_direct_sale_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_date: payload.date as string,
    p_etat_plante: payload.etat_plante as string,
    p_poids_g: payload.poids_g as number,
    p_destinataire: (payload.destinataire as string) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchAdjustment({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_adjustment_with_stock', {
    p_farm_id: farm_id,
    p_uuid_client: uuid_client,
    p_variety_id: payload.variety_id as string,
    p_partie_plante: payload.partie_plante as string,
    p_date: payload.date as string,
    p_type_mouvement: payload.type_mouvement as string,
    p_etat_plante: payload.etat_plante as string,
    p_poids_g: payload.poids_g as number,
    p_motif: payload.motif as string,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
  })
  if (error) throw new Error(error.message)
  return { server_id: String(data) }
}

async function dispatchProductionLot({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()

  // Vérifier l'existence de la recette
  const { data: recipe, error: recipeErr } = await admin
    .from('recipes')
    .select('id, nom, poids_sachet_g')
    .eq('id', payload.recipe_id as string)
    .eq('farm_id', farm_id)
    .single()

  if (recipeErr || !recipe) throw new Error('Recette introuvable')

  // Générer le numéro de lot
  const { generateProductionLotNumber, getRecipeCode } = await import('@/lib/utils/lots')
  const dateProd = new Date(payload.date_production as string)
  const code = getRecipeCode(recipe.nom)
  let numeroLot = generateProductionLotNumber(code, dateProd)

  // Vérifier l'unicité et suffixer si nécessaire
  const { data: existing } = await admin
    .from('production_lots')
    .select('numero_lot')
    .eq('farm_id', farm_id)
    .like('numero_lot', `${numeroLot}%`)

  if (existing && existing.length > 0) {
    const usedNumbers = new Set(existing.map((e: { numero_lot: string }) => e.numero_lot))
    if (usedNumbers.has(numeroLot)) {
      let suffix = 2
      while (usedNumbers.has(`${numeroLot}-${suffix}`)) suffix++
      numeroLot = `${numeroLot}-${suffix}`
    }
  }

  // DDM = date + 24 mois
  const ddm = new Date(dateProd)
  ddm.setMonth(ddm.getMonth() + 24)
  const ddmStr = ddm.toISOString().split('T')[0]

  // Préparer les ingrédients au format JSONB
  const ingredients = payload.ingredients as Array<Record<string, unknown>>
  const ingredientsJsonb = ingredients.map((ing) => ({
    variety_id: (ing.variety_id as string) ?? null,
    external_material_id: (ing.external_material_id as string) ?? null,
    etat_plante: (ing.etat_plante as string) ?? null,
    partie_plante: (ing.partie_plante as string) ?? null,
    pourcentage: ing.pourcentage as number,
    poids_g: ing.poids_g as number,
    annee_recolte: (ing.annee_recolte as number) ?? null,
    fournisseur: (ing.fournisseur as string) ?? null,
  }))

  // Idempotence : vérifier si le uuid_client existe déjà
  const { data: existingLot } = await admin
    .from('production_lots')
    .select('id')
    .eq('uuid_client', uuid_client)
    .single()

  if (existingLot) return { server_id: existingLot.id }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lotId, error } = await (admin as any).rpc('create_production_lot_with_stock', {
    p_farm_id: farm_id,
    p_recipe_id: payload.recipe_id as string,
    p_mode: payload.mode as string,
    p_numero_lot: numeroLot,
    p_date_production: payload.date_production as string,
    p_ddm: ddmStr,
    p_nb_unites: (payload.nb_unites as number) ?? null,
    p_poids_total_g: (payload.poids_total_g as number) ?? null,
    p_temps_min: (payload.temps_min as number) ?? null,
    p_commentaire: (payload.commentaire as string) ?? null,
    p_created_by: user_id,
    p_ingredients: ingredientsJsonb,
  })

  if (error) throw new Error(error.message)
  return { server_id: String(lotId) }
}

// ─────────────────────────────────────────────────────────────
// Tables avec INSERT direct
// ─────────────────────────────────────────────────────────────

/**
 * INSERT simple avec idempotence via ON CONFLICT (uuid_client) DO NOTHING.
 * Utilisé pour soil_works, row_care, occultations.
 */
async function dispatchSimpleInsert(
  table: 'soil_works' | 'row_care' | 'occultations',
  { farm_id, user_id, uuid_client, payload }: DispatchParams,
): Promise<DispatchResult> {
  const admin = createAdminClient()

  const row = { ...payload, uuid_client, farm_id, created_by: user_id }

  // INSERT avec RETURNING — si conflit uuid_client, RETURNING est vide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from(table) as any)
    .upsert(row, { onConflict: 'uuid_client', ignoreDuplicates: true })
    .select('id')
    .single()

  if (data) return { server_id: data.id }

  // Si upsert n'a pas retourné de donnée (conflit), récupérer l'existant
  if (!error || error.code === 'PGRST116') {
    const { data: existing } = await admin
      .from(table)
      .select('id')
      .eq('uuid_client', uuid_client)
      .single()

    if (existing) return { server_id: existing.id }
  }

  throw new Error(error?.message ?? `Erreur INSERT dans ${table}`)
}

/**
 * Sachet de graines : génère lot_interne automatiquement (SL-AAAA-NNN).
 * Numérotation scopée par farm_id.
 */
async function dispatchSeedLot({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()

  // Idempotence : vérifier si le uuid_client existe déjà
  const { data: existing } = await admin
    .from('seed_lots')
    .select('id')
    .eq('uuid_client', uuid_client)
    .single()

  if (existing) return { server_id: existing.id }

  // Générer le lot_interne
  const year = new Date().getFullYear()
  const { count, error: countError } = await admin
    .from('seed_lots')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', farm_id)
    .like('lot_interne', `SL-${year}-%`)

  if (countError) throw new Error(`Erreur génération numéro de lot : ${countError.message}`)

  const lot_interne = generateSeedLotNumber(year, count ?? 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('seed_lots') as any)
    .insert({ ...payload, uuid_client, lot_interne, farm_id, created_by: user_id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { server_id: data.id }
}

/**
 * Semis : normalise les champs nb_mortes_* de null → 0
 * (colonnes NOT NULL DEFAULT 0 en base).
 */
async function dispatchSeedling({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()

  // Idempotence
  const { data: existing } = await admin
    .from('seedlings')
    .select('id')
    .eq('uuid_client', uuid_client)
    .single()

  if (existing) return { server_id: existing.id }

  // Normalisation des champs mortes
  const normalized = {
    ...payload,
    nb_mortes_mottes: (payload.nb_mortes_mottes as number) ?? 0,
    nb_mortes_caissette: (payload.nb_mortes_caissette as number) ?? 0,
    nb_mortes_godet: (payload.nb_mortes_godet as number) ?? 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('seedlings') as any)
    .insert({ ...normalized, uuid_client, farm_id, created_by: user_id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { server_id: data.id }
}

/**
 * Plantation : pré-remplit longueur_m et largeur_m depuis le rang
 * si non fournis dans le payload. Force actif = true.
 */
async function dispatchPlanting({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()

  // Idempotence
  const { data: existing } = await admin
    .from('plantings')
    .select('id')
    .eq('uuid_client', uuid_client)
    .single()

  if (existing) return { server_id: existing.id }

  // Pré-remplissage dimensions depuis le rang
  let longueur_m = (payload.longueur_m as number | null) ?? null
  let largeur_m = (payload.largeur_m as number | null) ?? null

  if (longueur_m === null || largeur_m === null) {
    const { data: rowData } = await admin
      .from('rows')
      .select('longueur_m, largeur_m')
      .eq('id', payload.row_id as string)
      .single()

    if (rowData) {
      if (longueur_m === null) longueur_m = (rowData.longueur_m as number | null) ?? null
      if (largeur_m === null) largeur_m = (rowData.largeur_m as number | null) ?? null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('plantings') as any)
    .insert({ ...payload, longueur_m, largeur_m, actif: true, uuid_client, farm_id, created_by: user_id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { server_id: data.id }
}

/**
 * Arrachage : INSERT + désactivation des plantings actifs du rang.
 * Si variety_id spécifié → désactive uniquement cette variété.
 */
async function dispatchUprooting({ farm_id, user_id, uuid_client, payload }: DispatchParams): Promise<DispatchResult> {
  const admin = createAdminClient()

  // Idempotence
  const { data: existing } = await admin
    .from('uprootings')
    .select('id')
    .eq('uuid_client', uuid_client)
    .single()

  if (existing) return { server_id: existing.id }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('uprootings') as any)
    .insert({ ...payload, uuid_client, farm_id, created_by: user_id })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Désactiver les plantings actifs correspondants
  const rowId = payload.row_id as string
  const varietyId = (payload.variety_id as string) ?? null

  let query = admin
    .from('plantings')
    .update({ actif: false, updated_by: user_id })
    .eq('row_id', rowId)
    .eq('actif', true)
    .is('deleted_at', null)

  if (varietyId) {
    query = query.eq('variety_id', varietyId)
  }

  // Erreur non bloquante : l'arrachage est déjà enregistré
  await query

  return { server_id: data.id }
}
