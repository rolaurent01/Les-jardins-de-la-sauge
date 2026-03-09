/**
 * Schémas de validation Zod pour le module Produits.
 * Couvre les recettes, lots de production, conditionnement et mouvements de stock.
 */

import { z } from 'zod'
import { PARTIES_PLANTE } from '@/lib/types'

// ---- Helpers (identiques à transformation.ts) ----

const dateNotInFuture = z.string().refine(
  (val) => {
    if (!val) return true
    const inputDate = new Date(val)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return inputDate <= today
  },
  { message: 'La date ne peut pas être dans le futur' },
)

const positiveDecimal = z
  .number({ error: 'Doit être un nombre' })
  .positive('Doit être supérieur à 0')
  .refine((v) => Math.round(v * 100) / 100 === v, {
    message: 'Maximum 2 décimales',
  })

const positiveInt = z
  .number({ error: 'Doit être un entier' })
  .int('Doit être un entier')
  .positive('Doit être supérieur à 0')

// ---- Ingrédient recette (sous-schéma) ----

const recipeIngredientSchema = z.object({
  variety_id: z.string().uuid().optional().nullable(),
  external_material_id: z.string().uuid().optional().nullable(),
  etat_plante: z.string().optional().nullable(),
  partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]).optional().nullable(),
  pourcentage: z.number().gt(0, 'Doit être > 0').lte(1, 'Doit être ≤ 100%'),
  ordre: z.number().int().optional().nullable(),
})

// ---- Recette ----

export const recipeSchema = z
  .object({
    nom: z.string().min(1, 'Nom requis').max(200),
    category_id: z.string().uuid().optional().nullable(),
    numero_tisane: z.string().optional().nullable(),
    poids_sachet_g: positiveDecimal,
    description: z.string().max(1000).optional().nullable(),
    ingredients: z.array(recipeIngredientSchema).min(1, 'Au moins un ingrédient requis'),
  })
  .superRefine((data, ctx) => {
    // Vérifier que chaque ingrédient a soit variety_id soit external_material_id
    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i]
      const hasVariety = !!ing.variety_id
      const hasExternal = !!ing.external_material_id
      if (hasVariety === hasExternal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', i],
          message: 'Chaque ingrédient doit avoir soit une variété soit une matière externe (pas les deux, pas aucun)',
        })
      }
      // Si variété, etat_plante et partie_plante obligatoires
      if (hasVariety) {
        if (!ing.etat_plante) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ingredients', i, 'etat_plante'],
            message: 'État plante requis pour un ingrédient variété',
          })
        }
        if (!ing.partie_plante) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ingredients', i, 'partie_plante'],
            message: 'Partie plante requise pour un ingrédient variété',
          })
        }
      }
    }
    // Vérifier que la somme des pourcentages = 1.0 (±0.001)
    const sum = data.ingredients.reduce((acc, ing) => acc + ing.pourcentage, 0)
    if (Math.abs(sum - 1.0) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients'],
        message: `La somme des pourcentages doit être 100% (actuellement ${(sum * 100).toFixed(1)}%)`,
      })
    }
  })

// ---- Ingrédient lot de production (sous-schéma étendu) ----

const productionIngredientSchema = recipeIngredientSchema.extend({
  poids_g: positiveDecimal,
  annee_recolte: z.number().int().min(1900).max(2100).optional().nullable(),
  fournisseur: z.string().optional().nullable(),
})

// ---- Lot de production ----

export const productionLotSchema = z
  .object({
    recipe_id: z.string().uuid('Recette invalide'),
    mode: z.enum(['produit', 'melange']),
    date_production: dateNotInFuture,
    nb_unites: positiveInt.optional().nullable(),
    poids_total_g: positiveDecimal.optional().nullable(),
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
    ingredients: z.array(productionIngredientSchema).min(1, 'Au moins un ingrédient requis'),
  })
  .superRefine((data, ctx) => {
    // Mode produit : nb_unites obligatoire
    if (data.mode === 'produit' && !data.nb_unites) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nb_unites'],
        message: 'Nombre d\'unités requis en mode produit',
      })
    }
    // Vérifier ingrédients
    for (let i = 0; i < data.ingredients.length; i++) {
      const ing = data.ingredients[i]
      const hasVariety = !!ing.variety_id
      const hasExternal = !!ing.external_material_id
      if (hasVariety === hasExternal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', i],
          message: 'Chaque ingrédient doit avoir soit une variété soit une matière externe',
        })
      }
      if (hasVariety) {
        if (!ing.etat_plante) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ingredients', i, 'etat_plante'],
            message: 'État plante requis pour un ingrédient variété',
          })
        }
        if (!ing.partie_plante) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ingredients', i, 'partie_plante'],
            message: 'Partie plante requise pour un ingrédient variété',
          })
        }
      }
      // Si matière externe, fournisseur obligatoire
      if (hasExternal && !ing.fournisseur) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', i, 'fournisseur'],
          message: 'Fournisseur requis pour une matière externe',
        })
      }
    }
    // Mode produit : somme des pourcentages = 1.0
    if (data.mode === 'produit') {
      const sum = data.ingredients.reduce((acc, ing) => acc + ing.pourcentage, 0)
      if (Math.abs(sum - 1.0) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients'],
          message: `La somme des pourcentages doit être 100% (actuellement ${(sum * 100).toFixed(1)}%)`,
        })
      }
    }
  })

// ---- Conditionnement ----

export const conditionnerSchema = z.object({
  nb_unites: positiveInt,
})

// ---- Mouvement de stock produit fini ----

export const productStockMovementSchema = z.object({
  production_lot_id: z.string().uuid('Lot invalide'),
  date: dateNotInFuture,
  type_mouvement: z.enum(['entree', 'sortie']),
  quantite: positiveInt,
  commentaire: z.string().max(1000).optional().nullable(),
})
