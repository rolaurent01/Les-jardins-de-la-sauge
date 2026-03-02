import { describe, it, expect } from 'vitest'
import { generateSeedLotNumber } from '@/lib/utils/lots'

describe('generateSeedLotNumber', () => {
  it('devrait retourner le format SL-AAAA-NNN correct', () => {
    const result = generateSeedLotNumber(2025, 0)
    expect(result).toBe('SL-2025-001')
  })

  it('devrait padder le numéro de séquence sur 3 chiffres', () => {
    expect(generateSeedLotNumber(2025, 0)).toBe('SL-2025-001')
    expect(generateSeedLotNumber(2025, 8)).toBe('SL-2025-009')
    expect(generateSeedLotNumber(2025, 9)).toBe('SL-2025-010')
    expect(generateSeedLotNumber(2025, 99)).toBe('SL-2025-100')
  })

  it('devrait incrémenter correctement à partir du nombre existant', () => {
    // 5 lots existants → le suivant est le 6ème
    expect(generateSeedLotNumber(2025, 5)).toBe('SL-2025-006')
  })

  it('devrait gérer différentes années', () => {
    expect(generateSeedLotNumber(2024, 0)).toBe('SL-2024-001')
    expect(generateSeedLotNumber(2026, 42)).toBe('SL-2026-043')
  })

  it('devrait fonctionner au-delà de 999 lots (pas de troncature)', () => {
    // Au-delà de 999, le padding n'écrase pas les chiffres significatifs
    expect(generateSeedLotNumber(2025, 999)).toBe('SL-2025-1000')
  })
})
