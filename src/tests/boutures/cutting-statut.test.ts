import { describe, it, expect } from 'vitest'
import { computeCuttingStatut, computeCuttingPlantsRestants } from '@/lib/utils/cutting-statut'

describe('computeCuttingStatut', () => {
  it("devrait retourner 'bouture' à l'état initial", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: null, nb_plants_obtenus: null },
      0,
    )
    expect(statut).toBe('bouture')
  })

  it("devrait retourner 'bouture' quand plaque sans rempotage", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: 2, date_rempotage: null, nb_plants_obtenus: null },
      0,
    )
    expect(statut).toBe('bouture')
  })

  it("devrait retourner 'repiquage' quand plaque + date_rempotage", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: 2, date_rempotage: '2025-04-10', nb_plants_obtenus: null },
      0,
    )
    expect(statut).toBe('repiquage')
  })

  it("devrait retourner 'bouture' quand direct godet + date_rempotage (pas de plaque)", () => {
    // Sans plaque, date_rempotage ne déclenche pas le statut repiquage
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: '2025-04-10', nb_plants_obtenus: null },
      0,
    )
    expect(statut).toBe('bouture')
  })

  it("devrait retourner 'pret' quand plants obtenus et aucun planté", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: null, nb_plants_obtenus: 30 },
      0,
    )
    expect(statut).toBe('pret')
  })

  it("devrait retourner 'en_plantation' quand certains plants plantés", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: null, nb_plants_obtenus: 30 },
      15,
    )
    expect(statut).toBe('en_plantation')
  })

  it("devrait retourner 'epuise' quand tous les plants plantés", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: null, nb_plants_obtenus: 30 },
      30,
    )
    expect(statut).toBe('epuise')
  })

  it("devrait retourner 'epuise' quand plus de plants plantés que obtenus", () => {
    const statut = computeCuttingStatut(
      { nb_plaques: null, date_rempotage: null, nb_plants_obtenus: 30 },
      35,
    )
    expect(statut).toBe('epuise')
  })
})

describe('computeCuttingPlantsRestants', () => {
  it('devrait retourner null si nb_plants_obtenus est null', () => {
    expect(computeCuttingPlantsRestants(null, 0)).toBeNull()
  })

  it('devrait retourner le nombre de plants restants', () => {
    expect(computeCuttingPlantsRestants(30, 10)).toBe(20)
  })

  it('devrait retourner 0 et non un négatif', () => {
    expect(computeCuttingPlantsRestants(10, 15)).toBe(0)
  })
})
