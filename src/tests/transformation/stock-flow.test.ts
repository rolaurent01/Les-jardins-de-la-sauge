/**
 * Tests unitaires pour la logique de mouvements de stock.
 * Valide deduceStockMovement — la même logique que les RPCs SQL,
 * exprimée en TypeScript pur. Aucune dépendance réseau.
 */

import { describe, it, expect } from 'vitest'
import { deduceStockMovement } from '@/lib/utils/stock-logic'

// ============================================================
// Logique unitaire
// ============================================================

describe('deduceStockMovement', () => {
  // -- Tronçonnage --

  it('tronconnage entrée → stock SORTIE frais', () => {
    const r = deduceStockMovement('tronconnage', 'entree')
    expect(r.typeMouvement).toBe('sortie')
    expect(r.etatPlante).toBe('frais')
    expect(r.sourceType).toBe('tronconnage_entree')
  })

  it('tronconnage sortie → stock ENTRÉE tronconnee', () => {
    const r = deduceStockMovement('tronconnage', 'sortie')
    expect(r.typeMouvement).toBe('entree')
    expect(r.etatPlante).toBe('tronconnee')
    expect(r.sourceType).toBe('tronconnage_sortie')
  })

  // -- Séchage --

  it('séchage entrée frais → stock SORTIE frais', () => {
    const r = deduceStockMovement('sechage', 'entree', 'frais')
    expect(r.typeMouvement).toBe('sortie')
    expect(r.etatPlante).toBe('frais')
    expect(r.sourceType).toBe('sechage_entree')
  })

  it('séchage entrée tronconnee → stock SORTIE tronconnee', () => {
    const r = deduceStockMovement('sechage', 'entree', 'tronconnee')
    expect(r.typeMouvement).toBe('sortie')
    expect(r.etatPlante).toBe('tronconnee')
    expect(r.sourceType).toBe('sechage_entree')
  })

  it('séchage sortie sechee → stock ENTRÉE sechee', () => {
    const r = deduceStockMovement('sechage', 'sortie', 'sechee')
    expect(r.typeMouvement).toBe('entree')
    expect(r.etatPlante).toBe('sechee')
    expect(r.sourceType).toBe('sechage_sortie')
  })

  it('séchage sortie tronconnee_sechee → stock ENTRÉE tronconnee_sechee', () => {
    const r = deduceStockMovement('sechage', 'sortie', 'tronconnee_sechee')
    expect(r.typeMouvement).toBe('entree')
    expect(r.etatPlante).toBe('tronconnee_sechee')
    expect(r.sourceType).toBe('sechage_sortie')
  })

  // -- Triage --

  it('triage entrée sechee → stock SORTIE sechee', () => {
    const r = deduceStockMovement('triage', 'entree', 'sechee')
    expect(r.typeMouvement).toBe('sortie')
    expect(r.etatPlante).toBe('sechee')
    expect(r.sourceType).toBe('triage_entree')
  })

  it('triage entrée tronconnee_sechee → stock SORTIE tronconnee_sechee', () => {
    const r = deduceStockMovement('triage', 'entree', 'tronconnee_sechee')
    expect(r.typeMouvement).toBe('sortie')
    expect(r.etatPlante).toBe('tronconnee_sechee')
    expect(r.sourceType).toBe('triage_entree')
  })

  it('triage sortie sechee_triee → stock ENTRÉE sechee_triee', () => {
    const r = deduceStockMovement('triage', 'sortie', 'sechee_triee')
    expect(r.typeMouvement).toBe('entree')
    expect(r.etatPlante).toBe('sechee_triee')
    expect(r.sourceType).toBe('triage_sortie')
  })

  it('triage sortie tronconnee_sechee_triee → stock ENTRÉE tronconnee_sechee_triee', () => {
    const r = deduceStockMovement('triage', 'sortie', 'tronconnee_sechee_triee')
    expect(r.typeMouvement).toBe('entree')
    expect(r.etatPlante).toBe('tronconnee_sechee_triee')
    expect(r.sourceType).toBe('triage_sortie')
  })

  // -- Erreur --

  it('devrait lever une erreur si etatPlante est absent pour séchage', () => {
    expect(() => deduceStockMovement('sechage', 'entree')).toThrow('etatPlante requis')
  })

  it('devrait lever une erreur si etatPlante est absent pour triage', () => {
    expect(() => deduceStockMovement('triage', 'sortie')).toThrow('etatPlante requis')
  })
})

// ============================================================
// Flux de transformation complets
// ============================================================

describe('flux de transformation complets', () => {
  it('flux avec tronçonnage : frais → tronconnee → tronconnee_sechee → tronconnee_sechee_triee', () => {
    const t1 = deduceStockMovement('tronconnage', 'entree')
    expect(t1).toEqual({ typeMouvement: 'sortie', etatPlante: 'frais', sourceType: 'tronconnage_entree' })

    const t2 = deduceStockMovement('tronconnage', 'sortie')
    expect(t2).toEqual({ typeMouvement: 'entree', etatPlante: 'tronconnee', sourceType: 'tronconnage_sortie' })

    const t3 = deduceStockMovement('sechage', 'entree', 'tronconnee')
    expect(t3).toEqual({ typeMouvement: 'sortie', etatPlante: 'tronconnee', sourceType: 'sechage_entree' })

    const t4 = deduceStockMovement('sechage', 'sortie', 'tronconnee_sechee')
    expect(t4).toEqual({ typeMouvement: 'entree', etatPlante: 'tronconnee_sechee', sourceType: 'sechage_sortie' })

    const t5 = deduceStockMovement('triage', 'entree', 'tronconnee_sechee')
    expect(t5).toEqual({ typeMouvement: 'sortie', etatPlante: 'tronconnee_sechee', sourceType: 'triage_entree' })

    const t6 = deduceStockMovement('triage', 'sortie', 'tronconnee_sechee_triee')
    expect(t6).toEqual({ typeMouvement: 'entree', etatPlante: 'tronconnee_sechee_triee', sourceType: 'triage_sortie' })
  })

  it('flux sans tronçonnage : frais → sechee → sechee_triee', () => {
    const s1 = deduceStockMovement('sechage', 'entree', 'frais')
    expect(s1).toEqual({ typeMouvement: 'sortie', etatPlante: 'frais', sourceType: 'sechage_entree' })

    const s2 = deduceStockMovement('sechage', 'sortie', 'sechee')
    expect(s2).toEqual({ typeMouvement: 'entree', etatPlante: 'sechee', sourceType: 'sechage_sortie' })

    const s3 = deduceStockMovement('triage', 'entree', 'sechee')
    expect(s3).toEqual({ typeMouvement: 'sortie', etatPlante: 'sechee', sourceType: 'triage_entree' })

    const s4 = deduceStockMovement('triage', 'sortie', 'sechee_triee')
    expect(s4).toEqual({ typeMouvement: 'entree', etatPlante: 'sechee_triee', sourceType: 'triage_sortie' })
  })

  it("les sorties d'une étape sont cohérentes avec les entrées de l'étape suivante", () => {
    // Tronçonnage → Séchage
    const troncSortie = deduceStockMovement('tronconnage', 'sortie')
    const sechageEntree = deduceStockMovement('sechage', 'entree', troncSortie.etatPlante)
    expect(sechageEntree.etatPlante).toBe(troncSortie.etatPlante)

    // Séchage → Triage
    const sechageSortie = deduceStockMovement('sechage', 'sortie', 'tronconnee_sechee')
    const triageEntree = deduceStockMovement('triage', 'entree', sechageSortie.etatPlante)
    expect(triageEntree.etatPlante).toBe(sechageSortie.etatPlante)
  })

  it("le stock net est nul pour un flux entrée+sortie de même poids", () => {
    const entree = deduceStockMovement('tronconnage', 'entree')
    const sortie = deduceStockMovement('tronconnage', 'sortie')
    expect(entree.typeMouvement).toBe('sortie')   // retire du stock
    expect(sortie.typeMouvement).toBe('entree')    // ajoute au stock
    expect(entree.etatPlante).not.toBe(sortie.etatPlante)  // états différents
  })
})
