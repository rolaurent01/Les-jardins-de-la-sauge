'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseRecipeForm } from '@/lib/utils/produits-parsers'
import type { ActionResult, Recipe, RecipeWithRelations, PartiePlante } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere toutes les recettes de la ferme courante avec categories et ingredients */
export async function fetchRecipes(): Promise<RecipeWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('recipes')
    .select(
      '*, product_categories(id, nom), recipe_ingredients(*, varieties(id, nom_vernaculaire), external_materials(id, nom))',
    )
    .eq('farm_id', farmId)
    .order('nom', { ascending: true })

  if (error) throw new Error(`Erreur lors du chargement des recettes : ${error.message}`)

  return (data ?? []) as unknown as RecipeWithRelations[]
}

// ---- Actions ----

/** Cree une recette avec ses ingredients */
export async function createRecipe(formData: FormData): Promise<ActionResult<Recipe>> {
  const parsed = parseRecipeForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // 1. Creer la recette
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      farm_id: farmId,
      nom: parsed.data.nom,
      category_id: parsed.data.category_id ?? null,
      numero_tisane: parsed.data.numero_tisane ?? null,
      poids_sachet_g: parsed.data.poids_sachet_g,
      description: parsed.data.description ?? null,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { error: mapSupabaseError(error) }

  // 2. Inserer les ingredients
  const ingredients = parsed.data.ingredients.map((ing, idx) => ({
    recipe_id: recipe.id,
    variety_id: ing.variety_id ?? null,
    external_material_id: ing.external_material_id ?? null,
    etat_plante: ing.etat_plante ?? null,
    partie_plante: (ing.partie_plante ?? null) as PartiePlante | null,
    pourcentage: ing.pourcentage,
    ordre: ing.ordre ?? idx,
  }))

  const { error: ingError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredients)

  if (ingError) return { error: `Erreur ingredients : ${ingError.message}` }

  revalidatePath(buildPath(orgSlug, '/produits/recettes'))
  return { success: true, data: { id: recipe.id } as unknown as Recipe }
}

/** Met a jour une recette existante (supprime + recree les ingredients) */
export async function updateRecipe(
  id: string,
  formData: FormData,
): Promise<ActionResult<Recipe>> {
  const parsed = parseRecipeForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // 1. Mettre a jour la recette
  const { error } = await supabase
    .from('recipes')
    .update({
      nom: parsed.data.nom,
      category_id: parsed.data.category_id ?? null,
      numero_tisane: parsed.data.numero_tisane ?? null,
      poids_sachet_g: parsed.data.poids_sachet_g,
      description: parsed.data.description ?? null,
      updated_by: userId,
    })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  // 2. Supprimer les anciens ingredients
  const { error: delError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', id)

  if (delError) return { error: `Erreur suppression ingredients : ${delError.message}` }

  // 3. Re-inserer les nouveaux ingredients
  const ingredients = parsed.data.ingredients.map((ing, idx) => ({
    recipe_id: id,
    variety_id: ing.variety_id ?? null,
    external_material_id: ing.external_material_id ?? null,
    etat_plante: ing.etat_plante ?? null,
    partie_plante: (ing.partie_plante ?? null) as PartiePlante | null,
    pourcentage: ing.pourcentage,
    ordre: ing.ordre ?? idx,
  }))

  const { error: ingError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredients)

  if (ingError) return { error: `Erreur ingredients : ${ingError.message}` }

  revalidatePath(buildPath(orgSlug, '/produits/recettes'))
  return { success: true, data: { id } as unknown as Recipe }
}

/** Soft delete d'une recette */
export async function archiveRecipe(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('recipes')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/recettes'))
  return { success: true }
}

/** Restaure une recette archivee */
export async function restoreRecipe(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { error } = await supabase
    .from('recipes')
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/recettes'))
  return { success: true }
}

/** Bascule le champ actif (true <-> false) */
export async function toggleRecipeActive(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Lire l'etat actuel
  const { data: recipe, error: readError } = await supabase
    .from('recipes')
    .select('actif')
    .eq('id', id)
    .eq('farm_id', farmId)
    .single()

  if (readError || !recipe) return { error: 'Recette introuvable' }

  const { error } = await supabase
    .from('recipes')
    .update({ actif: !recipe.actif, updated_by: userId })
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/recettes'))
  return { success: true }
}
