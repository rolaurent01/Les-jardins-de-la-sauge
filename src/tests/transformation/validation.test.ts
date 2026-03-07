/**
 * Tests unitaires pour les schémas Zod du module Transformation.
 * Valide cuttingSchema, dryingSchema, sortingSchema.
 * Aucune dépendance réseau.
 */

import { describe, it, expect } from 'vitest'
import { cuttingSchema, dryingSchema, sortingSchema } from '@/lib/validation/transformation'

// ---- Helpers ----

function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const TODAY = relativeDate(0)
const YESTERDAY = relativeDate(-1)
const TOMORROW = relativeDate(1)

const VARIETY_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

// ============================================================
// cuttingSchema
// ============================================================

describe('cuttingSchema', () => {
  const BASE = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree' as const,
    date: YESTERDAY,
    poids_g: 150.5,
  }

  describe('cas valides', () => {
    it('devrait accepter une entrée minimale valide', () => {
      const result = cuttingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter une sortie valide avec tous les champs', () => {
      const result = cuttingSchema.safeParse({
        ...BASE,
        type: 'sortie',
        temps_min: 30,
        commentaire: 'Test commentaire',
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter poids_g avec 2 décimales (0.01)', () => {
      const result = cuttingSchema.safeParse({ ...BASE, poids_g: 0.01 })
      expect(result.success).toBe(true)
    })

    it('devrait accepter chaque valeur de partie_plante', () => {
      const parts = ['feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'] as const
      for (const p of parts) {
        const result = cuttingSchema.safeParse({ ...BASE, partie_plante: p })
        expect(result.success).toBe(true)
      }
    })

    it("devrait accepter la date d'aujourd'hui", () => {
      const result = cuttingSchema.safeParse({ ...BASE, date: TODAY })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand variety_id est absent', () => {
      const { variety_id: _, ...rest } = BASE
      const result = cuttingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand variety_id est un UUID invalide', () => {
      const result = cuttingSchema.safeParse({ ...BASE, variety_id: 'pas-un-uuid' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter un type invalide', () => {
      const result = cuttingSchema.safeParse({ ...BASE, type: 'transform' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter une date dans le futur', () => {
      const result = cuttingSchema.safeParse({ ...BASE, date: TOMORROW })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date')
      }
    })

    it('devrait rejeter poids_g négatif', () => {
      const result = cuttingSchema.safeParse({ ...BASE, poids_g: -5 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter poids_g à 0', () => {
      const result = cuttingSchema.safeParse({ ...BASE, poids_g: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter poids_g avec 3 décimales', () => {
      const result = cuttingSchema.safeParse({ ...BASE, poids_g: 1.234 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min négatif', () => {
      const result = cuttingSchema.safeParse({ ...BASE, temps_min: -1 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min décimal', () => {
      const result = cuttingSchema.safeParse({ ...BASE, temps_min: 1.5 })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================
// dryingSchema
// ============================================================

describe('dryingSchema', () => {
  const BASE = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree' as const,
    etat_plante: 'frais',
    date: YESTERDAY,
    poids_g: 200,
  }

  describe('cas valides', () => {
    it("devrait accepter une entrée avec etat_plante 'frais'", () => {
      const result = dryingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it("devrait accepter une entrée avec etat_plante 'tronconnee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, etat_plante: 'tronconnee' })
      expect(result.success).toBe(true)
    })

    it("devrait accepter une sortie avec etat_plante 'sechee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'sechee' })
      expect(result.success).toBe(true)
    })

    it("devrait accepter une sortie avec etat_plante 'tronconnee_sechee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'tronconnee_sechee' })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides — validation conditionnelle type ↔ etat_plante', () => {
    it("devrait rejeter entrée avec etat_plante 'sechee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, etat_plante: 'sechee' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('etat_plante')
      }
    })

    it("devrait rejeter entrée avec etat_plante 'tronconnee_sechee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, etat_plante: 'tronconnee_sechee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter entrée avec etat_plante 'sechee_triee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, etat_plante: 'sechee_triee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter sortie avec etat_plante 'frais'", () => {
      const result = dryingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'frais' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('etat_plante')
      }
    })

    it("devrait rejeter sortie avec etat_plante 'tronconnee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'tronconnee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter sortie avec etat_plante 'sechee_triee'", () => {
      const result = dryingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'sechee_triee' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter etat_plante manquant', () => {
      const { etat_plante: _, ...rest } = BASE
      const result = dryingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it("devrait rejeter etat_plante valeur inconnue ('cuit')", () => {
      const result = dryingSchema.safeParse({ ...BASE, etat_plante: 'cuit' })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================
// sortingSchema
// ============================================================

describe('sortingSchema', () => {
  const BASE = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree' as const,
    etat_plante: 'sechee',
    date: YESTERDAY,
    poids_g: 100,
  }

  describe('cas valides', () => {
    it("devrait accepter une entrée avec etat_plante 'sechee'", () => {
      const result = sortingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it("devrait accepter une entrée avec etat_plante 'tronconnee_sechee'", () => {
      const result = sortingSchema.safeParse({ ...BASE, etat_plante: 'tronconnee_sechee' })
      expect(result.success).toBe(true)
    })

    it("devrait accepter une sortie avec etat_plante 'sechee_triee'", () => {
      const result = sortingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'sechee_triee' })
      expect(result.success).toBe(true)
    })

    it("devrait accepter une sortie avec etat_plante 'tronconnee_sechee_triee'", () => {
      const result = sortingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'tronconnee_sechee_triee' })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides — validation conditionnelle type ↔ etat_plante', () => {
    it("devrait rejeter entrée avec etat_plante 'frais'", () => {
      const result = sortingSchema.safeParse({ ...BASE, etat_plante: 'frais' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('etat_plante')
      }
    })

    it("devrait rejeter entrée avec etat_plante 'tronconnee'", () => {
      const result = sortingSchema.safeParse({ ...BASE, etat_plante: 'tronconnee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter entrée avec etat_plante 'sechee_triee' (déjà triée)", () => {
      const result = sortingSchema.safeParse({ ...BASE, etat_plante: 'sechee_triee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter sortie avec etat_plante 'frais'", () => {
      const result = sortingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'frais' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter sortie avec etat_plante 'sechee' (non triée)", () => {
      const result = sortingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'sechee' })
      expect(result.success).toBe(false)
    })

    it("devrait rejeter sortie avec etat_plante 'tronconnee_sechee'", () => {
      const result = sortingSchema.safeParse({ ...BASE, type: 'sortie', etat_plante: 'tronconnee_sechee' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter etat_plante manquant', () => {
      const { etat_plante: _, ...rest } = BASE
      const result = sortingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter etat_plante valeur inconnue', () => {
      const result = sortingSchema.safeParse({ ...BASE, etat_plante: 'cuit' })
      expect(result.success).toBe(false)
    })
  })
})
