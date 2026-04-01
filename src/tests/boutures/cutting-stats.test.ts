import { describe, it, expect } from 'vitest'
import {
  computePlaqueLossRate,
  computeGodetDirectLossRate,
  computeCuttingLossRate,
} from '@/lib/utils/cutting-stats'
import type { Bouture } from '@/lib/types'

/** Fabrique un objet Bouture minimal pour les tests */
function makeCutting(overrides: Partial<Bouture>): Bouture {
  return {
    id: 'test-id',
    farm_id: 'farm-id',
    uuid_client: null,
    variety_id: null,
    type_multiplication: 'bouture',
    origine: null,
    certif_ab: false,
    statut: 'bouture',
    nb_plaques: null,
    nb_trous_par_plaque: null,
    nb_mortes_plaque: null,
    date_mise_en_plaque: null,
    temps_bouturage_min: null,
    nb_godets: null,
    nb_mortes_godet: null,
    date_rempotage: null,
    temps_rempotage_min: null,
    nb_plants_obtenus: null,
    nb_donnees: null,
    date_bouturage: '2025-04-01',
    commentaire: null,
    deleted_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2025-04-01T00:00:00Z',
    ...overrides,
  }
}

// ---- Tests computePlaqueLossRate ----

describe('computePlaqueLossRate', () => {
  it('devrait calculer la perte pour 2 plaques × 77 trous → 120 obtenus', () => {
    const cutting = makeCutting({
      nb_plaques: 2,
      nb_trous_par_plaque: 77,
      nb_mortes_plaque: 10,
      nb_godets: 130,
      nb_mortes_godet: 8,
      nb_donnees: 2,
      nb_plants_obtenus: 120,
    })
    const stats = computePlaqueLossRate(cutting)

    expect(stats.total_depart).toBe(154) // 2 × 77
    expect(stats.mortes_plaque).toBe(10)
    expect(stats.mortes_godet).toBe(8)
    expect(stats.donnees).toBe(2)
    expect(stats.plantes).toBe(120)
    // Perte plaque : 10/154 ≈ 6.49%
    expect(stats.perte_plaque_pct).toBeCloseTo(6.49, 1)
    // Perte godet : (8+2)/130 ≈ 7.69%
    expect(stats.perte_godet_pct).toBeCloseTo(7.69, 1)
    // Perte globale : 1 - (120/154) ≈ 22.08%
    expect(stats.perte_globale_pct).toBeCloseTo(22.08, 1)
  })

  it('devrait retourner null si données manquantes', () => {
    const cutting = makeCutting({
      nb_plaques: 2,
      nb_trous_par_plaque: 77,
    })
    const stats = computePlaqueLossRate(cutting)

    expect(stats.perte_plaque_pct).toBeNull()
    expect(stats.perte_globale_pct).toBeNull()
  })
})

// ---- Tests computeGodetDirectLossRate ----

describe('computeGodetDirectLossRate', () => {
  it('devrait calculer la perte pour 50 godets → 35 obtenus', () => {
    const cutting = makeCutting({
      nb_godets: 50,
      nb_mortes_godet: 10,
      nb_donnees: 5,
      nb_plants_obtenus: 35,
    })
    const stats = computeGodetDirectLossRate(cutting)

    expect(stats.total_depart).toBe(50)
    expect(stats.mortes_godet).toBe(10)
    expect(stats.donnees).toBe(5)
    expect(stats.plantes).toBe(35)
    // Perte : 1 - (35/50) = 30%
    expect(stats.perte_pct).toBe(30)
  })

  it('devrait retourner null si nb_godets manquant', () => {
    const cutting = makeCutting({
      nb_plants_obtenus: 35,
    })
    const stats = computeGodetDirectLossRate(cutting)
    expect(stats.perte_pct).toBeNull()
  })
})

// ---- Tests computeCuttingLossRate (dispatcher) ----

describe('computeCuttingLossRate', () => {
  it('devrait utiliser computePlaqueLossRate quand nb_plaques renseigné', () => {
    const cutting = makeCutting({
      nb_plaques: 1,
      nb_trous_par_plaque: 50,
      nb_mortes_plaque: 5,
      nb_plants_obtenus: 40,
    })
    const stats = computeCuttingLossRate(cutting)
    expect('perte_globale_pct' in stats).toBe(true)
  })

  it('devrait utiliser computeGodetDirectLossRate quand nb_plaques absent', () => {
    const cutting = makeCutting({
      nb_godets: 50,
      nb_plants_obtenus: 40,
    })
    const stats = computeCuttingLossRate(cutting)
    expect('perte_pct' in stats).toBe(true)
  })
})
