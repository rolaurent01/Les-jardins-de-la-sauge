'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'

/* ---------------------------------------------------------------
   Types — structure arborescente de traçabilité
--------------------------------------------------------------- */

export interface LotSearchResult {
  id: string
  numero_lot: string
  date_production: string
  ddm: string | null
  nb_unites: number | null
  poids_total_g: number | null
  recipe_nom: string
  recipe_poids_sachet_g: number | null
  category_nom: string | null
}

export interface LotTraceability {
  lot: {
    id: string
    numero_lot: string
    date_production: string
    ddm: string | null
    nb_unites: number | null
    poids_total_g: number | null
    recipe_nom: string
    recipe_poids_sachet_g: number | null
    category_nom: string | null
    temps_min: number | null
    commentaire: string | null
  }
  ingredients: IngredientTrace[]
}

export interface IngredientTrace {
  variety_id: string | null
  external_material_id: string | null
  nom: string
  pourcentage: number
  poids_g: number
  etat_plante: string | null
  partie_plante: string | null
  annee_recolte: number | null
  fournisseur: string | null

  cueillettes: {
    id: string
    date: string
    poids_g: number
    type_cueillette: string
    lieu: string
    row_id: string | null
  }[]

  plantations: {
    id: string
    date_plantation: string
    nb_plants: number | null
    type_plant: string | null
    rang: string
    seedling_id: string | null
    seedling_numero: string | null
    seedling_date_semis: string | null
    seed_lot_id: string | null
    seed_lot_interne: string | null
    seed_fournisseur: string | null
    seed_certif_ab: boolean | null
  }[]

  is_external: boolean
}

/* ---------------------------------------------------------------
   Helpers — résolution recette + catégorie
--------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = ReturnType<typeof createAdminClient>

interface RecipeInfo {
  nom: string
  poids_sachet_g: number | null
  category_nom: string | null
}

/** Résout les recettes par ID en batch */
async function resolveRecipes(
  supabase: SupabaseAdmin,
  recipeIds: string[],
): Promise<Map<string, RecipeInfo>> {
  if (recipeIds.length === 0) return new Map()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, nom, poids_sachet_g, category_id')
    .in('id', recipeIds)

  if (!recipes || recipes.length === 0) return new Map()

  // Résoudre les catégories
  const catIds = [...new Set(recipes.filter(r => r.category_id).map(r => r.category_id!))]
  const catMap = new Map<string, string>()
  if (catIds.length > 0) {
    const { data: cats } = await supabase
      .from('product_categories')
      .select('id, nom')
      .in('id', catIds)
    for (const c of cats ?? []) {
      catMap.set(c.id, c.nom)
    }
  }

  const map = new Map<string, RecipeInfo>()
  for (const r of recipes) {
    map.set(r.id, {
      nom: r.nom,
      poids_sachet_g: r.poids_sachet_g,
      category_nom: r.category_id ? (catMap.get(r.category_id) ?? null) : null,
    })
  }
  return map
}

/* ---------------------------------------------------------------
   searchProductionLots — recherche lots par numéro ou recette
--------------------------------------------------------------- */

export async function searchProductionLots(
  query: string,
): Promise<LotSearchResult[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('production_lots')
    .select('id, numero_lot, date_production, ddm, nb_unites, poids_total_g, recipe_id')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_production', { ascending: false })
    .limit(50)

  if (error) throw new Error(`Erreur recherche lots : ${error.message}`)
  if (!data || data.length === 0) return []

  // Résoudre les recettes
  const recipeIds = [...new Set(data.filter(l => l.recipe_id).map(l => l.recipe_id!))]
  const recipeMap = await resolveRecipes(supabase, recipeIds)

  // Enrichir et filtrer
  const enriched = data.map(lot => {
    const recipe = lot.recipe_id ? recipeMap.get(lot.recipe_id) : null
    return {
      id: lot.id,
      numero_lot: lot.numero_lot ?? '',
      date_production: lot.date_production,
      ddm: lot.ddm,
      nb_unites: lot.nb_unites ?? 0,
      poids_total_g: lot.poids_total_g ?? 0,
      recipe_nom: recipe?.nom ?? 'Recette inconnue',
      recipe_poids_sachet_g: recipe?.poids_sachet_g ?? null,
      category_nom: recipe?.category_nom ?? null,
    }
  })

  if (!query.trim()) return enriched.slice(0, 20)

  const search = query.trim().toLowerCase()
  return enriched
    .filter(lot => {
      const matchLot = (lot.numero_lot ?? '').toLowerCase().includes(search)
      const matchRecipe = lot.recipe_nom.toLowerCase().includes(search)
      return matchLot || matchRecipe
    })
    .slice(0, 20)
}

/* ---------------------------------------------------------------
   fetchLotTraceability — chaîne complète lot → graine
--------------------------------------------------------------- */

export async function fetchLotTraceability(
  lotId: string,
): Promise<LotTraceability> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  // ── Étape 1 : charger le lot ──
  const { data: lot, error: lotErr } = await supabase
    .from('production_lots')
    .select('id, numero_lot, date_production, ddm, nb_unites, poids_total_g, temps_min, commentaire, recipe_id')
    .eq('id', lotId)
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .single()

  if (lotErr || !lot) throw new Error('Lot introuvable')

  // Résoudre la recette
  const recipeMap = await resolveRecipes(supabase, lot.recipe_id ? [lot.recipe_id] : [])
  const recipe = lot.recipe_id ? recipeMap.get(lot.recipe_id) : null

  // ── Étape 2 : charger les ingrédients du lot ──
  const { data: ingredients, error: ingErr } = await supabase
    .from('production_lot_ingredients')
    .select('id, variety_id, external_material_id, etat_plante, partie_plante, pourcentage, poids_g, annee_recolte, fournisseur')
    .eq('production_lot_id', lotId)
    .eq('farm_id', farmId)
    .order('pourcentage', { ascending: false })

  if (ingErr) throw new Error(`Erreur ingrédients : ${ingErr.message}`)

  // ── Résoudre les noms de variétés et matériaux ──
  const varietyIds = [...new Set((ingredients ?? []).filter(i => i.variety_id).map(i => i.variety_id!))]
  const materialIds = [...new Set((ingredients ?? []).filter(i => i.external_material_id).map(i => i.external_material_id!))]

  const [varietiesRes, materialsRes] = await Promise.all([
    varietyIds.length > 0
      ? supabase.from('varieties').select('id, nom_vernaculaire').in('id', varietyIds)
      : { data: [], error: null },
    materialIds.length > 0
      ? supabase.from('external_materials').select('id, nom').in('id', materialIds)
      : { data: [], error: null },
  ])

  const varietyMap = new Map((varietiesRes.data ?? []).map(v => [v.id, v.nom_vernaculaire]))
  const materialMap = new Map((materialsRes.data ?? []).map(m => [m.id, m.nom]))

  // ── Étape 3 : pour chaque ingrédient plante, remonter la chaîne ──
  const dateProduction = new Date(lot.date_production)
  const productionYear = dateProduction.getFullYear()

  const traces: IngredientTrace[] = await Promise.all(
    (ingredients ?? []).map(async (ing) => {
      const isExternal = !ing.variety_id
      const nom = ing.variety_id
        ? (varietyMap.get(ing.variety_id) ?? 'Variété inconnue')
        : (ing.external_material_id ? (materialMap.get(ing.external_material_id) ?? 'Matériau inconnu') : 'Inconnu')

      if (isExternal) {
        return {
          variety_id: null,
          external_material_id: ing.external_material_id,
          nom,
          pourcentage: Number(ing.pourcentage),
          poids_g: Number(ing.poids_g),
          etat_plante: ing.etat_plante,
          partie_plante: ing.partie_plante,
          annee_recolte: ing.annee_recolte,
          fournisseur: ing.fournisseur,
          cueillettes: [],
          plantations: [],
          is_external: true,
        }
      }

      const targetYear = ing.annee_recolte ?? productionYear

      // ── Cueillettes : requête séparée + résolution lieu ──
      const { data: harvests } = await supabase
        .from('harvests')
        .select('id, date, poids_g, type_cueillette, lieu_sauvage, row_id')
        .eq('farm_id', farmId)
        .eq('variety_id', ing.variety_id!)
        .gte('date', `${targetYear}-01-01`)
        .lte('date', `${targetYear}-12-31`)
        .is('deleted_at', null)
        .order('date', { ascending: true })

      // Résoudre les lieux des cueillettes (rangs → parcelles → sites)
      const harvestRowIds = [...new Set((harvests ?? []).filter(h => h.row_id).map(h => h.row_id!))]
      const rowMap = await resolveRows(supabase, harvestRowIds)

      const cueillettes = (harvests ?? []).map(h => {
        let lieu = h.lieu_sauvage ?? ''
        if (h.type_cueillette === 'parcelle' && h.row_id) {
          lieu = rowMap.get(h.row_id) ?? 'Rang inconnu'
        }
        return {
          id: h.id,
          date: h.date,
          poids_g: Number(h.poids_g),
          type_cueillette: h.type_cueillette,
          lieu,
          row_id: h.row_id,
        }
      })

      // ── Plantations de cette variété ──
      const { data: plantings } = await supabase
        .from('plantings')
        .select('id, date_plantation, nb_plants, type_plant, seedling_id, row_id')
        .eq('farm_id', farmId)
        .eq('variety_id', ing.variety_id!)
        .is('deleted_at', null)
        .order('date_plantation', { ascending: false })

      // Résoudre les lieux des plantations
      const plantRowIds = [...new Set((plantings ?? []).filter(p => p.row_id).map(p => p.row_id!))]
      const plantRowMap = await resolveRows(supabase, plantRowIds)

      // Résoudre les semis + sachets
      const seedlingIds = [...new Set((plantings ?? []).filter(p => p.seedling_id).map(p => p.seedling_id!))]
      const seedlingMap = await resolveSeedlings(supabase, seedlingIds)

      const plantationsList = (plantings ?? []).map(p => {
        const rang = p.row_id ? (plantRowMap.get(p.row_id) ?? 'Rang inconnu') : 'Rang inconnu'
        const seedling = p.seedling_id ? seedlingMap.get(p.seedling_id) : null
        const seedlingNumero = seedling ? `SM-${seedling.id.slice(0, 8)}` : null

        return {
          id: p.id,
          date_plantation: p.date_plantation,
          nb_plants: p.nb_plants,
          type_plant: p.type_plant,
          rang,
          seedling_id: p.seedling_id,
          seedling_numero: seedlingNumero,
          seedling_date_semis: seedling?.date_semis ?? null,
          seed_lot_id: seedling?.seed_lot_id ?? null,
          seed_lot_interne: seedling?.seed_lot_interne ?? null,
          seed_fournisseur: seedling?.seed_fournisseur ?? null,
          seed_certif_ab: seedling?.seed_certif_ab ?? null,
        }
      })

      return {
        variety_id: ing.variety_id,
        external_material_id: null,
        nom,
        pourcentage: Number(ing.pourcentage),
        poids_g: Number(ing.poids_g),
        etat_plante: ing.etat_plante,
        partie_plante: ing.partie_plante,
        annee_recolte: ing.annee_recolte,
        fournisseur: ing.fournisseur,
        cueillettes,
        plantations: plantationsList,
        is_external: false,
      }
    })
  )

  return {
    lot: {
      id: lot.id,
      numero_lot: lot.numero_lot ?? '',
      date_production: lot.date_production,
      ddm: lot.ddm,
      nb_unites: lot.nb_unites ?? 0,
      poids_total_g: lot.poids_total_g ?? 0,
      recipe_nom: recipe?.nom ?? 'Recette inconnue',
      recipe_poids_sachet_g: recipe?.poids_sachet_g ?? null,
      category_nom: recipe?.category_nom ?? null,
      temps_min: lot.temps_min,
      commentaire: lot.commentaire,
    },
    ingredients: traces,
  }
}

/* ---------------------------------------------------------------
   Helpers — résolution rangs et semis (sans FK joins)
--------------------------------------------------------------- */

/** Résout les rangs par ID → "Rang X (Site, Parcelle)" */
async function resolveRows(
  supabase: SupabaseAdmin,
  rowIds: string[],
): Promise<Map<string, string>> {
  if (rowIds.length === 0) return new Map()

  const { data: rows } = await supabase
    .from('rows')
    .select('id, numero, parcel_id')
    .in('id', rowIds)

  if (!rows || rows.length === 0) return new Map()

  // Résoudre parcelles
  const parcelIds = [...new Set(rows.filter(r => r.parcel_id).map(r => r.parcel_id!))]
  const { data: parcels } = await supabase
    .from('parcels')
    .select('id, nom, site_id')
    .in('id', parcelIds)

  const parcelMap = new Map((parcels ?? []).map(p => [p.id, p]))

  // Résoudre sites
  const siteIds = [...new Set((parcels ?? []).filter(p => p.site_id).map(p => p.site_id!))]
  const { data: sites } = await supabase
    .from('sites')
    .select('id, nom')
    .in('id', siteIds)

  const siteMap = new Map((sites ?? []).map(s => [s.id, s.nom]))

  const map = new Map<string, string>()
  for (const row of rows) {
    const parcel = row.parcel_id ? parcelMap.get(row.parcel_id) : null
    const siteNom = parcel?.site_id ? (siteMap.get(parcel.site_id) ?? '') : ''
    const parcelNom = parcel?.nom ?? ''
    map.set(row.id, `Rang ${row.numero} (${siteNom}, ${parcelNom})`)
  }
  return map
}

interface SeedlingInfo {
  id: string
  date_semis: string | null
  seed_lot_id: string | null
  seed_lot_interne: string | null
  seed_fournisseur: string | null
  seed_certif_ab: boolean | null
}

/** Résout les semis par ID → infos semis + sachet de graines */
async function resolveSeedlings(
  supabase: SupabaseAdmin,
  seedlingIds: string[],
): Promise<Map<string, SeedlingInfo>> {
  if (seedlingIds.length === 0) return new Map()

  const { data: seedlings } = await supabase
    .from('seedlings')
    .select('id, date_semis, seed_lot_id')
    .in('id', seedlingIds)

  if (!seedlings || seedlings.length === 0) return new Map()

  // Résoudre les sachets de graines
  const seedLotIds = [...new Set(seedlings.filter(s => s.seed_lot_id).map(s => s.seed_lot_id!))]
  const seedLotMap = new Map<string, { lot_interne: string | null; fournisseur: string | null; certif_ab: boolean | null }>()

  if (seedLotIds.length > 0) {
    const { data: seedLots } = await supabase
      .from('seed_lots')
      .select('id, lot_interne, fournisseur, certif_ab')
      .in('id', seedLotIds)

    for (const sl of seedLots ?? []) {
      seedLotMap.set(sl.id, { lot_interne: sl.lot_interne, fournisseur: sl.fournisseur, certif_ab: sl.certif_ab })
    }
  }

  const map = new Map<string, SeedlingInfo>()
  for (const s of seedlings) {
    const seedLot = s.seed_lot_id ? seedLotMap.get(s.seed_lot_id) : null
    map.set(s.id, {
      id: s.id,
      date_semis: s.date_semis,
      seed_lot_id: s.seed_lot_id,
      seed_lot_interne: seedLot?.lot_interne ?? null,
      seed_fournisseur: seedLot?.fournisseur ?? null,
      seed_certif_ab: seedLot?.certif_ab ?? null,
    })
  }
  return map
}
