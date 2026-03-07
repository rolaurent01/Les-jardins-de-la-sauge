/**
 * Tests unitaires pour les parsers du module Transformation.
 * Valide parseCuttingForm, parseDryingForm, parseSortingForm.
 * Aucune dépendance réseau : seul le parsing FormData → objet validé est testé.
 */

import { describe, it, expect } from 'vitest'
import { parseCuttingForm, parseDryingForm, parseSortingForm } from '@/lib/utils/transformation-parsers'

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

// ============================================================
// parseCuttingForm
// ============================================================

describe('parseCuttingForm', () => {
  const BASE: Record<string, string> = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree',
    date: YESTERDAY,
    poids_g: '150.50',
  }

  describe('cas valides', () => {
    it('devrait parser un formulaire minimal valide', () => {
      const result = parseCuttingForm(makeFormData(BASE))
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data.variety_id).toBe(VARIETY_UUID)
        expect(result.data.type).toBe('entree')
      }
    })

    it('devrait parser un formulaire complet', () => {
      const result = parseCuttingForm(makeFormData({
        ...BASE,
        temps_min: '30',
        commentaire: 'Un commentaire',
      }))
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data.temps_min).toBe(30)
        expect(result.data.commentaire).toBe('Un commentaire')
      }
    })

    it("devrait convertir poids_g string '150.50' en number 150.5", () => {
      const result = parseCuttingForm(makeFormData(BASE))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.poids_g).toBe(150.5)
    })

    it('devrait convertir temps_min vide en null', () => {
      const result = parseCuttingForm(makeFormData({ ...BASE, temps_min: '' }))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.temps_min).toBeNull()
    })

    it('devrait convertir commentaire vide en null', () => {
      const result = parseCuttingForm(makeFormData({ ...BASE, commentaire: '' }))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.commentaire).toBeNull()
    })
  })

  describe('cas invalides', () => {
    it('devrait retourner { error } si variety_id est manquant', () => {
      const { variety_id: _, ...rest } = BASE
      const result = parseCuttingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })

    it("devrait retourner { error } si poids_g est non numérique ('abc')", () => {
      const result = parseCuttingForm(makeFormData({ ...BASE, poids_g: 'abc' }))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si type est manquant', () => {
      const { type: _, ...rest } = BASE
      const result = parseCuttingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })
  })
})

// ============================================================
// parseDryingForm
// ============================================================

describe('parseDryingForm', () => {
  const BASE: Record<string, string> = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree',
    etat_plante: 'frais',
    date: YESTERDAY,
    poids_g: '200',
  }

  describe('cas valides', () => {
    it("devrait parser une entrée avec etat_plante 'frais'", () => {
      const result = parseDryingForm(makeFormData(BASE))
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data.etat_plante).toBe('frais')
        expect(result.data.type).toBe('entree')
      }
    })

    it("devrait parser une sortie avec etat_plante 'tronconnee_sechee'", () => {
      const result = parseDryingForm(makeFormData({
        ...BASE,
        type: 'sortie',
        etat_plante: 'tronconnee_sechee',
      }))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.etat_plante).toBe('tronconnee_sechee')
    })
  })

  describe('cas invalides', () => {
    it("devrait retourner { error } pour entrée avec etat_plante 'sechee'", () => {
      const result = parseDryingForm(makeFormData({ ...BASE, etat_plante: 'sechee' }))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si etat_plante est manquant', () => {
      const { etat_plante: _, ...rest } = BASE
      const result = parseDryingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si etat_plante est inconnu', () => {
      const result = parseDryingForm(makeFormData({ ...BASE, etat_plante: 'cuit' }))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si poids_g est manquant', () => {
      const { poids_g: _, ...rest } = BASE
      const result = parseDryingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })
  })
})

// ============================================================
// parseSortingForm
// ============================================================

describe('parseSortingForm', () => {
  const BASE: Record<string, string> = {
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    type: 'entree',
    etat_plante: 'sechee',
    date: YESTERDAY,
    poids_g: '100',
  }

  describe('cas valides', () => {
    it("devrait parser une entrée avec etat_plante 'sechee'", () => {
      const result = parseSortingForm(makeFormData(BASE))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.etat_plante).toBe('sechee')
    })

    it("devrait parser une sortie avec etat_plante 'tronconnee_sechee_triee'", () => {
      const result = parseSortingForm(makeFormData({
        ...BASE,
        type: 'sortie',
        etat_plante: 'tronconnee_sechee_triee',
      }))
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.etat_plante).toBe('tronconnee_sechee_triee')
    })
  })

  describe('cas invalides', () => {
    it("devrait retourner { error } pour entrée avec etat_plante 'frais'", () => {
      const result = parseSortingForm(makeFormData({ ...BASE, etat_plante: 'frais' }))
      expect('error' in result).toBe(true)
    })

    it("devrait retourner { error } pour sortie avec etat_plante 'tronconnee_sechee'", () => {
      const result = parseSortingForm(makeFormData({ ...BASE, type: 'sortie', etat_plante: 'tronconnee_sechee' }))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si etat_plante est manquant', () => {
      const { etat_plante: _, ...rest } = BASE
      const result = parseSortingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si poids_g est manquant', () => {
      const { poids_g: _, ...rest } = BASE
      const result = parseSortingForm(makeFormData(rest))
      expect('error' in result).toBe(true)
    })
  })
})
