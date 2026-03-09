/**
 * Tests unitaires pour les parsers du module Produits.
 * Valide parseRecipeForm, parseProductionLotForm, parseConditionnerForm, parseProductStockMovementForm.
 * Aucune dependance reseau : seul le parsing FormData → objet valide est teste.
 */

import { describe, it, expect } from 'vitest'
import {
  parseRecipeForm,
  parseProductionLotForm,
  parseConditionnerForm,
  parseProductStockMovementForm,
} from '@/lib/utils/produits-parsers'

// ---- Helpers ----

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const YESTERDAY = relativeDate(-1)
const VARIETY_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const RECIPE_UUID = 'e4ccfa33-3a4f-4cd2-bf01-0ff3f1724e55'
const LOT_UUID = 'f5ddab44-4b5a-4de3-8a12-1aa4a2835f66'

// ============================================================
// parseRecipeForm
// ============================================================

describe('parseRecipeForm', () => {
  it('devrait parser un formulaire valide avec ingredients JSON', () => {
    const ingredients = JSON.stringify([
      { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee', partie_plante: 'feuille', pourcentage: 0.60, ordre: 1 },
      { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee', partie_plante: 'fleur', pourcentage: 0.40, ordre: 2 },
    ])
    const fd = makeFormData({
      nom: 'Ma Recette',
      poids_sachet_g: '25',
      ingredients,
    })

    const result = parseRecipeForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.nom).toBe('Ma Recette')
      expect(result.data.poids_sachet_g).toBe(25)
      expect(result.data.ingredients).toHaveLength(2)
    }
  })

  it('devrait retourner { error } si JSON ingredients est malforme', () => {
    const fd = makeFormData({
      nom: 'Test',
      poids_sachet_g: '25',
      ingredients: '{pas du json valide[',
    })
    const result = parseRecipeForm(fd)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('JSON invalide')
    }
  })

  it('devrait retourner { error } si nom est manquant', () => {
    const fd = makeFormData({
      nom: '',
      poids_sachet_g: '25',
      ingredients: JSON.stringify([
        { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee', partie_plante: 'feuille', pourcentage: 1.0 },
      ]),
    })
    const result = parseRecipeForm(fd)
    expect('error' in result).toBe(true)
  })
})

// ============================================================
// parseProductionLotForm
// ============================================================

describe('parseProductionLotForm', () => {
  it('devrait parser un formulaire valide avec mode produit + ingredients JSON', () => {
    const ingredients = JSON.stringify([
      { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee_triee', partie_plante: 'feuille', pourcentage: 0.60, poids_g: 150, annee_recolte: 2025, fournisseur: null },
      { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee_triee', partie_plante: 'fleur', pourcentage: 0.40, poids_g: 100, annee_recolte: 2025, fournisseur: null },
    ])
    const fd = makeFormData({
      recipe_id: RECIPE_UUID,
      mode: 'produit',
      date_production: YESTERDAY,
      nb_unites: '100',
      poids_total_g: '2500',
      temps_min: '120',
      commentaire: 'Lot test',
      ingredients,
    })

    const result = parseProductionLotForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.mode).toBe('produit')
      expect(result.data.nb_unites).toBe(100)
      expect(result.data.ingredients).toHaveLength(2)
    }
  })

  it('devrait retourner { error } si JSON ingredients est malforme', () => {
    const fd = makeFormData({
      recipe_id: RECIPE_UUID,
      mode: 'produit',
      date_production: YESTERDAY,
      nb_unites: '10',
      ingredients: 'nope',
    })
    const result = parseProductionLotForm(fd)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('JSON invalide')
    }
  })

  it('devrait retourner { error } si champs manquants (recipe_id vide)', () => {
    const fd = makeFormData({
      recipe_id: '',
      mode: 'produit',
      date_production: YESTERDAY,
      nb_unites: '10',
      ingredients: JSON.stringify([
        { variety_id: VARIETY_UUID, external_material_id: null, etat_plante: 'sechee', partie_plante: 'feuille', pourcentage: 1.0, poids_g: 25 },
      ]),
    })
    const result = parseProductionLotForm(fd)
    expect('error' in result).toBe(true)
  })
})

// ============================================================
// parseConditionnerForm
// ============================================================

describe('parseConditionnerForm', () => {
  it('devrait extraire nb_unites correctement', () => {
    const result = parseConditionnerForm(makeFormData({ nb_unites: '50' }))
    expect('data' in result).toBe(true)
    if ('data' in result) expect(result.data.nb_unites).toBe(50)
  })

  it('devrait retourner { error } si nb_unites = 0', () => {
    const result = parseConditionnerForm(makeFormData({ nb_unites: '0' }))
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si nb_unites est vide', () => {
    const result = parseConditionnerForm(makeFormData({ nb_unites: '' }))
    expect('error' in result).toBe(true)
  })
})

// ============================================================
// parseProductStockMovementForm
// ============================================================

describe('parseProductStockMovementForm', () => {
  const BASE: Record<string, string> = {
    production_lot_id: LOT_UUID,
    date: YESTERDAY,
    type_mouvement: 'entree',
    quantite: '100',
    commentaire: '',
  }

  it('devrait parser un mouvement entree valide', () => {
    const result = parseProductStockMovementForm(makeFormData(BASE))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.type_mouvement).toBe('entree')
      expect(result.data.quantite).toBe(100)
      expect(result.data.commentaire).toBeNull()
    }
  })

  it('devrait parser un mouvement sortie avec commentaire', () => {
    const result = parseProductStockMovementForm(makeFormData({
      ...BASE,
      type_mouvement: 'sortie',
      commentaire: 'Livraison marche',
    }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.type_mouvement).toBe('sortie')
      expect(result.data.commentaire).toBe('Livraison marche')
    }
  })

  it('devrait retourner { error } si production_lot_id est manquant', () => {
    const { production_lot_id: _, ...rest } = BASE
    const result = parseProductStockMovementForm(makeFormData(rest))
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si quantite est non numerique', () => {
    const result = parseProductStockMovementForm(makeFormData({ ...BASE, quantite: 'abc' }))
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si type_mouvement est invalide', () => {
    const result = parseProductStockMovementForm(makeFormData({ ...BASE, type_mouvement: 'ajustement' }))
    expect('error' in result).toBe(true)
  })
})
