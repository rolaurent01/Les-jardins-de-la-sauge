/**
 * Helpers de parsing pour les formulaires du module Produits.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { z } from 'zod'
import {
  recipeSchema,
  productionLotSchema,
  conditionnerSchema,
  productStockMovementSchema,
} from '@/lib/validation/produits'

// ---- Helpers ----

function parseOptionalInt(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  if (!v || v.trim() === '') return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

function parseOptionalDecimal(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function formatError(zodError: z.ZodError): string {
  const first = zodError.issues[0]
  const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
  return `${field}${first.message}`
}

// ---- Recette ----

export function parseRecipeForm(
  formData: FormData,
): { data: ReturnType<typeof recipeSchema.parse> } | { error: string } {
  // Les ingrédients arrivent en JSON
  let ingredients: unknown[] = []
  const ingredientsJson = formData.get('ingredients') as string
  if (ingredientsJson) {
    try {
      ingredients = JSON.parse(ingredientsJson)
    } catch {
      return { error: 'ingredients : JSON invalide' }
    }
  }

  const raw = {
    nom:            (formData.get('nom') as string)?.trim() || '',
    category_id:    (formData.get('category_id') as string) || null,
    numero_tisane:  (formData.get('numero_tisane') as string)?.trim() || null,
    poids_sachet_g: parseOptionalDecimal(formData, 'poids_sachet_g') ?? 0,
    description:    (formData.get('description') as string)?.trim() || null,
    ingredients,
  }

  const result = recipeSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Lot de production ----

export function parseProductionLotForm(
  formData: FormData,
): { data: ReturnType<typeof productionLotSchema.parse> } | { error: string } {
  // Les ingrédients arrivent en JSON
  let ingredients: unknown[] = []
  const ingredientsJson = formData.get('ingredients') as string
  if (ingredientsJson) {
    try {
      ingredients = JSON.parse(ingredientsJson)
    } catch {
      return { error: 'ingredients : JSON invalide' }
    }
  }

  const raw = {
    recipe_id:       (formData.get('recipe_id') as string) || '',
    mode:            (formData.get('mode') as string) || '',
    date_production: (formData.get('date_production') as string) || '',
    nb_unites:       parseOptionalInt(formData, 'nb_unites'),
    poids_total_g:   parseOptionalDecimal(formData, 'poids_total_g'),
    temps_min:       parseOptionalInt(formData, 'temps_min'),
    commentaire:     (formData.get('commentaire') as string)?.trim() || null,
    ingredients,
  }

  const result = productionLotSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Conditionnement ----

export function parseConditionnerForm(
  formData: FormData,
): { data: ReturnType<typeof conditionnerSchema.parse> } | { error: string } {
  const raw = {
    nb_unites: parseOptionalInt(formData, 'nb_unites') ?? 0,
  }

  const result = conditionnerSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Mouvement de stock produit fini ----

export function parseProductStockMovementForm(
  formData: FormData,
): { data: ReturnType<typeof productStockMovementSchema.parse> } | { error: string } {
  const raw = {
    production_lot_id: (formData.get('production_lot_id') as string) || '',
    date:              (formData.get('date') as string) || '',
    type_mouvement:    (formData.get('type_mouvement') as string) || '',
    quantite:          parseOptionalInt(formData, 'quantite') ?? 0,
    commentaire:       (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = productStockMovementSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}
