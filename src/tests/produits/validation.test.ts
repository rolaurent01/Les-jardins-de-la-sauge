/**
 * Tests unitaires pour les schemas Zod du module Produits.
 * Valide recipeSchema, productionLotSchema, conditionnerSchema, productStockMovementSchema.
 * Aucune dependance reseau.
 */

import { describe, it, expect } from 'vitest'
import {
  recipeSchema,
  productionLotSchema,
  conditionnerSchema,
  productStockMovementSchema,
} from '@/lib/validation/produits'

// ---- Helpers ----

function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const YESTERDAY = relativeDate(-1)
const TOMORROW = relativeDate(1)
const VARIETY_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const VARIETY_UUID_2 = 'b1ffcd00-0d1c-4fa9-8c7e-7cc0ce491b22'
const VARIETY_UUID_3 = 'c2aade11-1e2d-4ab0-9d8f-8dd1df502c33'
const MATERIAL_UUID = 'd3bbef22-2f3e-4bc1-ae90-9ee2e0613d44'
const RECIPE_UUID = 'e4ccfa33-3a4f-4cd2-bf01-0ff3f1724e55'
const LOT_UUID = 'f5ddab44-4b5a-4de3-8a12-1aa4a2835f66'

// ============================================================
// recipeSchema
// ============================================================

describe('recipeSchema', () => {
  const BASE_INGREDIENT_PLANTE = {
    variety_id: VARIETY_UUID,
    external_material_id: null,
    etat_plante: 'sechee_triee',
    partie_plante: 'feuille',
    pourcentage: 0.40,
    ordre: 1,
  }

  const BASE_INGREDIENT_MATERIAU = {
    variety_id: null,
    external_material_id: MATERIAL_UUID,
    etat_plante: null,
    partie_plante: null,
    pourcentage: 0.10,
    ordre: 3,
  }

  describe('cas valides', () => {
    it('devrait accepter une recette valide avec 3 ingredients plante totalisant 100%', () => {
      const result = recipeSchema.safeParse({
        nom: 'La Balade Digestive',
        category_id: null,
        numero_tisane: 'T01',
        poids_sachet_g: 25,
        description: null,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.40 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.35, ordre: 2 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_3, pourcentage: 0.25, ordre: 3 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter une recette valide avec mix plantes + materiau externe', () => {
      const result = recipeSchema.safeParse({
        nom: 'Sel Ail des ours',
        poids_sachet_g: 50,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.30 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.60, ordre: 2 },
          { ...BASE_INGREDIENT_MATERIAU, pourcentage: 0.10 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter une recette mono-ingredient a 100%', () => {
      const result = recipeSchema.safeParse({
        nom: 'Verveine pure',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 1.0 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter une recette 2 ingredients 50/50 (non-regression)', () => {
      const result = recipeSchema.safeParse({
        nom: 'Duo menthe-verveine',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.50 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.50, ordre: 2 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter la somme = 1.0 avec tolerance flottante (0.999)', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test tolerance',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.333 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.333, ordre: 2 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_3, pourcentage: 0.333, ordre: 3 },
        ],
      })
      // 0.333 * 3 = 0.999 — dans la tolerance ±0.001
      expect(result.success).toBe(true)
    })

    it('devrait accepter la somme = 1.001 avec tolerance flottante', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test tolerance haute',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.501 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.50, ordre: 2 },
        ],
      })
      // 0.501 + 0.50 = 1.001 — dans la tolerance ±0.001
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand la somme des pourcentages = 99%', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.50 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.49, ordre: 2 },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand la somme des pourcentages = 101%', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 0.50 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 0.51, ordre: 2 },
        ],
      })
      // 1.01 — hors tolerance
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un ingredient sans variety_id ni external_material_id', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { variety_id: null, external_material_id: null, pourcentage: 1.0, ordre: 1 },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un ingredient avec variety_id ET external_material_id', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { variety_id: VARIETY_UUID, external_material_id: MATERIAL_UUID, etat_plante: 'sechee', partie_plante: 'feuille', pourcentage: 1.0, ordre: 1 },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un nom vide', () => {
      const result = recipeSchema.safeParse({
        nom: '',
        poids_sachet_g: 25,
        ingredients: [{ ...BASE_INGREDIENT_PLANTE, pourcentage: 1.0 }],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un poids sachet negatif', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: -5,
        ingredients: [{ ...BASE_INGREDIENT_PLANTE, pourcentage: 1.0 }],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un poids sachet a zero', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 0,
        ingredients: [{ ...BASE_INGREDIENT_PLANTE, pourcentage: 1.0 }],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un pourcentage negatif', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: -0.1 },
          { ...BASE_INGREDIENT_PLANTE, variety_id: VARIETY_UUID_2, pourcentage: 1.1, ordre: 2 },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un pourcentage > 1', () => {
      const result = recipeSchema.safeParse({
        nom: 'Test',
        poids_sachet_g: 25,
        ingredients: [
          { ...BASE_INGREDIENT_PLANTE, pourcentage: 1.1 },
        ],
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================
// productionLotSchema
// ============================================================

describe('productionLotSchema', () => {
  const BASE_INGREDIENT_A = {
    variety_id: VARIETY_UUID,
    external_material_id: null,
    etat_plante: 'sechee_triee',
    partie_plante: 'feuille',
    pourcentage: 0.60,
    poids_g: 15,
    annee_recolte: 2025,
    fournisseur: null,
    ordre: 1,
  }
  const BASE_INGREDIENT_B = {
    variety_id: VARIETY_UUID_2,
    external_material_id: null,
    etat_plante: 'sechee_triee',
    partie_plante: 'fleur',
    pourcentage: 0.40,
    poids_g: 10,
    annee_recolte: 2025,
    fournisseur: null,
    ordre: 2,
  }

  describe('cas valides', () => {
    it('devrait accepter un lot valide en mode produit (nb_unites obligatoire)', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: 100,
        poids_total_g: 2500,
        temps_min: 120,
        commentaire: 'Test',
        ingredients: [BASE_INGREDIENT_A, BASE_INGREDIENT_B],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un lot valide en mode melange (nb_unites null)', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'melange',
        date_production: YESTERDAY,
        nb_unites: null,
        poids_total_g: 500,
        ingredients: [BASE_INGREDIENT_A, BASE_INGREDIENT_B],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un lot mono-ingredient a 100% en mode produit', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: 50,
        ingredients: [
          { ...BASE_INGREDIENT_A, pourcentage: 1.0, poids_g: 25 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un lot 2 ingredients 50/50 en mode produit (non-regression)', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: 50,
        ingredients: [
          { ...BASE_INGREDIENT_A, pourcentage: 0.50, poids_g: 12.5 },
          { ...BASE_INGREDIENT_B, pourcentage: 0.50, poids_g: 12.5 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un fournisseur optionnel sur ingredient plante', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: 50,
        ingredients: [
          { ...BASE_INGREDIENT_A, fournisseur: 'Ferme Bio' },
          BASE_INGREDIENT_B,
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter un mode produit sans nb_unites', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: null,
        ingredients: [BASE_INGREDIENT_A, BASE_INGREDIENT_B],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter une date dans le futur', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: TOMORROW,
        nb_unites: 10,
        ingredients: [BASE_INGREDIENT_A, BASE_INGREDIENT_B],
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un fournisseur manquant sur materiau externe', () => {
      const result = productionLotSchema.safeParse({
        recipe_id: RECIPE_UUID,
        mode: 'produit',
        date_production: YESTERDAY,
        nb_unites: 10,
        ingredients: [
          BASE_INGREDIENT_A,
          {
            variety_id: null,
            external_material_id: MATERIAL_UUID,
            etat_plante: null,
            partie_plante: null,
            pourcentage: 0.40,
            poids_g: 100,
            fournisseur: null,
            ordre: 2,
          },
        ],
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================
// conditionnerSchema
// ============================================================

describe('conditionnerSchema', () => {
  it('devrait accepter un nb_unites valide', () => {
    const result = conditionnerSchema.safeParse({ nb_unites: 50 })
    expect(result.success).toBe(true)
  })

  it('devrait rejeter nb_unites zero', () => {
    const result = conditionnerSchema.safeParse({ nb_unites: 0 })
    expect(result.success).toBe(false)
  })

  it('devrait rejeter nb_unites negatif', () => {
    const result = conditionnerSchema.safeParse({ nb_unites: -5 })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// productStockMovementSchema
// ============================================================

describe('productStockMovementSchema', () => {
  const BASE = {
    production_lot_id: LOT_UUID,
    date: YESTERDAY,
    type_mouvement: 'entree' as const,
    quantite: 100,
    commentaire: null,
  }

  describe('cas valides', () => {
    it('devrait accepter un mouvement entree valide', () => {
      const result = productStockMovementSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter un mouvement sortie valide', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, type_mouvement: 'sortie' })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un commentaire', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, commentaire: 'Livraison marche' })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter une quantite a zero', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, quantite: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter une quantite negative', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, quantite: -5 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un lot_id invalide', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, production_lot_id: 'pas-un-uuid' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un type_mouvement invalide', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, type_mouvement: 'ajustement' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter une date dans le futur', () => {
      const result = productStockMovementSchema.safeParse({ ...BASE, date: TOMORROW })
      expect(result.success).toBe(false)
    })
  })
})
