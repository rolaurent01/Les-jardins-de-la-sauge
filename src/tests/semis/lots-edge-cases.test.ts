/**
 * Tests unitaires complémentaires pour les utilitaires de génération de lots.
 * Couvre generateSeedlingNumber (SM-*) et generateProductionLotNumber,
 * non testés dans lots.test.ts qui se concentre sur generateSeedLotNumber (SL-*).
 */

import { describe, it, expect } from 'vitest'
import { generateSeedlingNumber, generateProductionLotNumber } from '@/lib/utils/lots'

// ============================================================
// generateSeedlingNumber
// ============================================================

describe('generateSeedlingNumber', () => {
  it('devrait retourner le format SM-AAAA-NNN correct', () => {
    expect(generateSeedlingNumber(2025, 0)).toBe('SM-2025-001')
  })

  it('devrait padder le numéro de séquence sur 3 chiffres', () => {
    expect(generateSeedlingNumber(2025, 0)).toBe('SM-2025-001')
    expect(generateSeedlingNumber(2025, 8)).toBe('SM-2025-009')
    expect(generateSeedlingNumber(2025, 9)).toBe('SM-2025-010')
  })

  it('devrait incrémenter correctement à partir du nombre existant', () => {
    // 5 semis existants → le suivant est le 6ème
    expect(generateSeedlingNumber(2025, 5)).toBe('SM-2025-006')
  })

  it('devrait gérer différentes années', () => {
    expect(generateSeedlingNumber(2024, 0)).toBe('SM-2024-001')
    expect(generateSeedlingNumber(2026, 42)).toBe('SM-2026-043')
  })

  it('devrait accepter un count élevé (au-delà de 99 — padding non tronqué)', () => {
    expect(generateSeedlingNumber(2025, 99)).toBe('SM-2025-100')
  })

  it('devrait fonctionner au-delà de 999 semis (pas de troncature)', () => {
    expect(generateSeedlingNumber(2025, 999)).toBe('SM-2025-1000')
  })
})

// ============================================================
// generateProductionLotNumber
// ============================================================

describe('generateProductionLotNumber', () => {
  it('devrait retourner le format [CODE]AAAAMMJJ correct', () => {
    // 4 juin 2025 → BD20250604
    const date = new Date(2025, 5, 4)
    expect(generateProductionLotNumber('BD', date)).toBe('BD20250604')
  })

  it('devrait padder le mois sur 2 chiffres (janvier = 01)', () => {
    const date = new Date(2025, 0, 15)
    expect(generateProductionLotNumber('NE', date)).toBe('NE20250115')
  })

  it('devrait padder le jour sur 2 chiffres (1er = 01)', () => {
    const date = new Date(2025, 5, 1)
    expect(generateProductionLotNumber('LS', date)).toBe('LS20250601')
  })

  it('devrait gérer la fin d\'année (31 décembre)', () => {
    const date = new Date(2025, 11, 31)
    expect(generateProductionLotNumber('SI', date)).toBe('SI20251231')
  })

  it('devrait utiliser le code recette tel quel en préfixe', () => {
    const date = new Date(2025, 5, 4)
    expect(generateProductionLotNumber('SIAV', date)).toBe('SIAV20250604')
  })
})
