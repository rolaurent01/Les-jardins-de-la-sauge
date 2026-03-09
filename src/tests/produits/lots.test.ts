/**
 * Tests unitaires pour la generation des numeros de lot de production.
 * Valide generateProductionLotNumber et getRecipeCode.
 * Aucune dependance reseau.
 */

import { describe, it, expect } from 'vitest'
import { generateProductionLotNumber, getRecipeCode, RECIPE_CODES } from '@/lib/utils/lots'

// ============================================================
// generateProductionLotNumber
// ============================================================

describe('generateProductionLotNumber', () => {
  it('devrait generer BD20250604 pour code BD et date 2025-06-04', () => {
    const result = generateProductionLotNumber('BD', new Date('2025-06-04'))
    expect(result).toBe('BD20250604')
  })

  it('devrait zero-padder le mois et le jour', () => {
    const result = generateProductionLotNumber('NE', new Date('2025-01-02'))
    expect(result).toBe('NE20250102')
  })

  it('devrait gerer un code a 3 caracteres', () => {
    const result = generateProductionLotNumber('SAO', new Date('2025-12-15'))
    expect(result).toBe('SAO20251215')
  })

  it('devrait gerer une date en fin d\'annee', () => {
    const result = generateProductionLotNumber('FC', new Date('2025-12-31'))
    expect(result).toBe('FC20251231')
  })
})

// ============================================================
// getRecipeCode
// ============================================================

describe('getRecipeCode', () => {
  it('devrait retourner BD pour La Balade Digestive', () => {
    expect(getRecipeCode('La Balade Digestive')).toBe('BD')
  })

  it('devrait retourner SAO pour Sel Ail des ours', () => {
    expect(getRecipeCode('Sel Ail des ours')).toBe('SAO')
  })

  it('devrait retourner NE pour Nuit Etoilee', () => {
    expect(getRecipeCode('Nuit Étoilée')).toBe('NE')
  })

  it('devrait retourner les 2 premieres lettres en majuscule pour un nom inconnu', () => {
    expect(getRecipeCode('Recette inconnue')).toBe('RE')
  })

  it('devrait gerer un nom court (2 caracteres)', () => {
    expect(getRecipeCode('Ab')).toBe('AB')
  })

  it('devrait couvrir toutes les recettes connues dans RECIPE_CODES', () => {
    for (const [nom, code] of Object.entries(RECIPE_CODES)) {
      expect(getRecipeCode(nom)).toBe(code)
    }
  })
})
