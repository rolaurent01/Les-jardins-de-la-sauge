'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseProductionLotForm, parseConditionnerForm } from '@/lib/utils/produits-parsers'
import { generateProductionLotNumber, getRecipeCode } from '@/lib/utils/lots'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type {
  ActionResult,
  ProductionLotWithRelations,
} from '@/lib/types'

// ---- Types internes ----

/** Recette avec ingredients pour le wizard de production */
export type RecipeForSelect = {
  id: string
  nom: string
  poids_sachet_g: number
  numero_tisane: string | null
  category_id: string | null
  recipe_ingredients: {
    id: string
    variety_id: string | null
    external_material_id: string | null
    etat_plante: string | null
    partie_plante: string | null
    pourcentage: number
    ordre: number | null
    varieties?: { id: string; nom_vernaculaire: string; parties_utilisees: string[] } | null
    external_materials?: { id: string; nom: string } | null
  }[]
}

// ---- Requetes ----

/** Recupere tous les lots de production de la ferme avec relations */
export async function fetchProductionLots(): Promise<ProductionLotWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('production_lots')
    .select(
      '*, recipes(id, nom, poids_sachet_g, numero_tisane), production_lot_ingredients(*, varieties(id, nom_vernaculaire), external_materials(id, nom))',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_production', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des lots : ${error.message}`)

  return (data ?? []) as unknown as ProductionLotWithRelations[]
}

/** Recupere les recettes actives avec leurs ingredients pour le wizard */
export async function fetchRecipesForSelect(): Promise<RecipeForSelect[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, nom, poids_sachet_g, numero_tisane, category_id, recipe_ingredients(*, varieties(id, nom_vernaculaire, parties_utilisees), external_materials(id, nom))',
    )
    .eq('farm_id', farmId)
    .eq('actif', true)
    .is('deleted_at', null)
    .order('nom', { ascending: true })

  if (error) throw new Error(`Erreur lors du chargement des recettes : ${error.message}`)

  return (data ?? []) as unknown as RecipeForSelect[]
}

// ---- Actions ----

/** Cree un lot de production avec stock via RPC transactionnelle */
export async function createProductionLot(
  formData: FormData,
): Promise<ActionResult<{ id: string; numero_lot: string }>> {
  const parsed = parseProductionLotForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Recuperer la recette pour generer le numero de lot
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .select('id, nom, poids_sachet_g')
    .eq('id', parsed.data.recipe_id)
    .eq('farm_id', farmId)
    .single()

  if (recipeErr || !recipe) return { error: 'Recette introuvable' }

  // Generer le numero de lot
  const dateProd = new Date(parsed.data.date_production)
  const code = getRecipeCode(recipe.nom)
  let numeroLot = generateProductionLotNumber(code, dateProd)

  // Verifier l'unicite et suffixer si necessaire
  const { data: existing } = await supabase
    .from('production_lots')
    .select('numero_lot')
    .eq('farm_id', farmId)
    .like('numero_lot', `${numeroLot}%`)

  if (existing && existing.length > 0) {
    const usedNumbers = new Set(existing.map(e => e.numero_lot))
    if (usedNumbers.has(numeroLot)) {
      let suffix = 2
      while (usedNumbers.has(`${numeroLot}-${suffix}`)) suffix++
      numeroLot = `${numeroLot}-${suffix}`
    }
  }

  // DDM — fournie par le formulaire (editee par l'utilisateur a l'etape confirmation)
  const ddmStr = (formData.get('ddm') as string) || (() => {
    const d = new Date(dateProd)
    d.setMonth(d.getMonth() + 24)
    return d.toISOString().split('T')[0]
  })()

  // Preparer les ingredients au format JSONB pour la RPC
  const ingredientsJsonb = parsed.data.ingredients.map(ing => ({
    variety_id: ing.variety_id ?? null,
    external_material_id: ing.external_material_id ?? null,
    etat_plante: ing.etat_plante ?? null,
    partie_plante: ing.partie_plante ?? null,
    pourcentage: ing.pourcentage,
    poids_g: ing.poids_g,
    annee_recolte: ing.annee_recolte ?? null,
    fournisseur: ing.fournisseur ?? null,
  }))

  // Cast : RPCs production pas encore dans les types Supabase generes
  const { data: lotId, error } = await (supabase as any).rpc('create_production_lot_with_stock', {
    p_farm_id: farmId,
    p_recipe_id: parsed.data.recipe_id,
    p_mode: parsed.data.mode,
    p_numero_lot: numeroLot,
    p_date_production: parsed.data.date_production,
    p_ddm: ddmStr,
    p_nb_unites: parsed.data.nb_unites ?? null,
    p_poids_total_g: parsed.data.poids_total_g ?? null,
    p_temps_min: parsed.data.temps_min ?? null,
    p_commentaire: parsed.data.commentaire ?? null,
    p_created_by: userId,
    p_ingredients: ingredientsJsonb,
  })

  if (error) {
    console.error('[createProductionLot] RPC error:', JSON.stringify(error))
    return { error: mapSupabaseError(error) }
  }

  revalidatePath(buildPath(orgSlug, '/produits/production'))
  return { success: true, data: { id: lotId as string, numero_lot: numeroLot } }
}

/** Soft delete d'un lot de production via RPC (restaure le stock) */
export async function archiveProductionLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('delete_production_lot_with_stock', {
    p_lot_id: id,
    p_farm_id: farmId,
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/production'))
  return { success: true }
}

/** Restaure un lot archive via RPC (re-verifie le stock) */
export async function restoreProductionLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('restore_production_lot_with_stock', {
    p_lot_id: id,
    p_farm_id: farmId,
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/production'))
  return { success: true }
}

/** Conditionne un lot melange (ajoute nb_unites) */
export async function conditionnerLot(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseConditionnerForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await (supabase as any).rpc('update_production_lot_conditionner', {
    p_lot_id: id,
    p_farm_id: farmId,
    p_nb_unites: parsed.data.nb_unites,
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/production'))
  return { success: true }
}
