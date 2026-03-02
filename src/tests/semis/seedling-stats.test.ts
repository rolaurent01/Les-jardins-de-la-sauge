import { describe, it, expect } from 'vitest'
import {
  computeMiniMotteLossRate,
  computeCaissetteGodetLossRate,
  computeSeedlingLossRate,
} from '@/lib/utils/seedling-stats'
import type { Seedling } from '@/lib/types'

/** Fabrique un objet Seedling minimal pour les tests */
function makeSeedling(overrides: Partial<Seedling>): Seedling {
  return {
    id: 'test-id',
    uuid_client: null,
    seed_lot_id: null,
    variety_id: null,
    processus: 'mini_motte',
    numero_caisse: null,
    nb_mottes: null,
    nb_mortes_mottes: null,
    nb_caissettes: null,
    nb_plants_caissette: null,
    nb_mortes_caissette: null,
    nb_godets: null,
    nb_mortes_godet: null,
    nb_donnees: null,
    nb_plants_obtenus: null,
    date_semis: '2025-06-01',
    poids_graines_utilise_g: null,
    date_levee: null,
    date_repiquage: null,
    temps_semis_min: null,
    temps_repiquage_min: null,
    commentaire: null,
    deleted_at: null,
    created_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

// ---- Tests computeMiniMotteLossRate ----

describe('computeMiniMotteLossRate', () => {
  it("devrait calculer 23% de perte — exemple du context.md (98 mottes → 75 plantées)", () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: 98,
      nb_mortes_mottes: 20,
      nb_donnees: 3,
      nb_plants_obtenus: 75,
    })
    const stats = computeMiniMotteLossRate(seedling)

    expect(stats.total_depart).toBe(98)
    expect(stats.mortes).toBe(20)
    expect(stats.donnees).toBe(3)
    expect(stats.plantes).toBe(75)
    // 1 - (75/98) ≈ 0.2347... → 23.47%
    expect(stats.perte_pct).toBeCloseTo(23.47, 1)
  })

  it('devrait retourner perte_pct null quand nb_mottes est null', () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: null,
      nb_plants_obtenus: 50,
    })
    const stats = computeMiniMotteLossRate(seedling)
    expect(stats.perte_pct).toBeNull()
  })

  it('devrait retourner perte_pct null quand nb_plants_obtenus est null', () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: 50,
      nb_plants_obtenus: null,
    })
    const stats = computeMiniMotteLossRate(seedling)
    expect(stats.perte_pct).toBeNull()
  })

  it('devrait retourner perte_pct null quand nb_mottes vaut 0 (division par zéro)', () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: 0,
      nb_plants_obtenus: 0,
    })
    const stats = computeMiniMotteLossRate(seedling)
    expect(stats.perte_pct).toBeNull()
  })

  it('devrait calculer 0% de perte quand tous les plants sont obtenus', () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: 50,
      nb_mortes_mottes: 0,
      nb_donnees: 0,
      nb_plants_obtenus: 50,
    })
    const stats = computeMiniMotteLossRate(seedling)
    expect(stats.perte_pct).toBe(0)
  })
})

// ---- Tests computeCaissetteGodetLossRate ----

describe('computeCaissetteGodetLossRate', () => {
  it("devrait calculer 30% de perte globale — exemple du context.md", () => {
    // 50 caissette → 45 godets (5 mortes) → 35 plantées (5 mortes + 5 données)
    const seedling = makeSeedling({
      processus: 'caissette_godet',
      nb_caissettes: 1,
      nb_plants_caissette: 50,
      nb_mortes_caissette: 5,
      nb_godets: 45,
      nb_mortes_godet: 5,
      nb_donnees: 5,
      nb_plants_obtenus: 35,
    })
    const stats = computeCaissetteGodetLossRate(seedling)

    expect(stats.total_depart).toBe(50)
    expect(stats.mortes_caissette).toBe(5)
    expect(stats.mortes_godet).toBe(5)
    expect(stats.donnees).toBe(5)
    expect(stats.plantes).toBe(35)
    // Perte caissette = 5/50 = 10%
    expect(stats.perte_caissette_pct).toBe(10)
    // Perte godet = (5 mortes + 5 données) / 45 godets ≈ 22.22%
    expect(stats.perte_godet_pct).toBeCloseTo(22.22, 1)
    // Perte globale = 1 - (35/50) = 30%
    expect(stats.perte_globale_pct).toBe(30)
  })

  it('devrait retourner tous les taux null quand nb_plants_caissette est null', () => {
    const seedling = makeSeedling({
      processus: 'caissette_godet',
      nb_plants_caissette: null,
      nb_plants_obtenus: 35,
    })
    const stats = computeCaissetteGodetLossRate(seedling)
    expect(stats.perte_caissette_pct).toBeNull()
    expect(stats.perte_globale_pct).toBeNull()
  })

  it('devrait retourner perte_godet_pct null quand nb_godets est null', () => {
    const seedling = makeSeedling({
      processus: 'caissette_godet',
      nb_plants_caissette: 50,
      nb_mortes_caissette: 5,
      nb_godets: null,
      nb_mortes_godet: 3,
      nb_donnees: 2,
      nb_plants_obtenus: 40,
    })
    const stats = computeCaissetteGodetLossRate(seedling)
    expect(stats.perte_godet_pct).toBeNull()
    // Les autres restent calculables
    expect(stats.perte_caissette_pct).toBe(10)
    expect(stats.perte_globale_pct).toBe(20)
  })

  it('devrait calculer 0% de perte globale quand tous les plants sont plantés', () => {
    const seedling = makeSeedling({
      processus: 'caissette_godet',
      nb_plants_caissette: 50,
      nb_mortes_caissette: 0,
      nb_godets: 50,
      nb_mortes_godet: 0,
      nb_donnees: 0,
      nb_plants_obtenus: 50,
    })
    const stats = computeCaissetteGodetLossRate(seedling)
    expect(stats.perte_globale_pct).toBe(0)
  })
})

// ---- Tests computeSeedlingLossRate (dispatcher) ----

describe('computeSeedlingLossRate', () => {
  it('devrait dispatcher vers computeMiniMotteLossRate pour processus mini_motte', () => {
    const seedling = makeSeedling({
      processus: 'mini_motte',
      nb_mottes: 100,
      nb_plants_obtenus: 80,
    })
    const stats = computeSeedlingLossRate(seedling)
    // La présence de `mortes` (et non `mortes_caissette`) confirme le bon dispatcher
    expect('mortes' in stats).toBe(true)
    expect('mortes_caissette' in stats).toBe(false)
  })

  it('devrait dispatcher vers computeCaissetteGodetLossRate pour processus caissette_godet', () => {
    const seedling = makeSeedling({
      processus: 'caissette_godet',
      nb_plants_caissette: 50,
      nb_plants_obtenus: 35,
    })
    const stats = computeSeedlingLossRate(seedling)
    // La présence de `mortes_caissette` confirme le bon dispatcher
    expect('mortes_caissette' in stats).toBe(true)
    expect('mortes' in stats).toBe(false)
  })
})
