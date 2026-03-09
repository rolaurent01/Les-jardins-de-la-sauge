/**
 * Tests unitaires pour la logique metier de stock du module Produits.
 * Tests de calcul pur — pas d'appels DB.
 */

import { describe, it, expect } from 'vitest'

// ---- Fonctions de logique pure extraites / testables ----

/** Verifie si le stock est suffisant pour un ingredient */
function checkStockSuffisant(
  stockDispo: number,
  requis: number,
): { ok: true } | { ok: false; message: string } {
  if (stockDispo >= requis) return { ok: true }
  return {
    ok: false,
    message: `Stock insuffisant : ${stockDispo} g disponible, ${requis} g requis`,
  }
}

/** Calcule le poids par ingredient en mode produit */
function calcPoidsModeProduit(
  nbUnites: number,
  poidsSachetG: number,
  pourcentage: number,
): number {
  return nbUnites * poidsSachetG * pourcentage
}

/** Calcule les pourcentages en mode melange a partir des poids reels */
function calcPourcentagesMelange(poids: number[]): number[] {
  const total = poids.reduce((acc, p) => acc + p, 0)
  if (total === 0) return poids.map(() => 0)
  return poids.map(p => Math.round((p / total) * 10000) / 10000)
}

/** Calcule le stock net produit fini a partir des mouvements */
function calcStockNetProduitFini(
  mouvements: { type: 'entree' | 'sortie'; quantite: number }[],
): number {
  return mouvements.reduce((acc, m) => {
    return acc + (m.type === 'entree' ? m.quantite : -m.quantite)
  }, 0)
}

// ============================================================
// Verification stock
// ============================================================

describe('checkStockSuffisant', () => {
  it('devrait retourner ok quand stock 500g, requis 300g', () => {
    const result = checkStockSuffisant(500, 300)
    expect(result.ok).toBe(true)
  })

  it('devrait retourner ok quand stock = requis exactement', () => {
    const result = checkStockSuffisant(300, 300)
    expect(result.ok).toBe(true)
  })

  it('devrait retourner erreur quand stock 200g, requis 300g', () => {
    const result = checkStockSuffisant(200, 300)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('200')
      expect(result.message).toContain('300')
    }
  })

  it('devrait retourner erreur quand stock 0g, requis 100g', () => {
    const result = checkStockSuffisant(0, 100)
    expect(result.ok).toBe(false)
  })
})

// ============================================================
// Calcul poids mode produit
// ============================================================

describe('calcPoidsModeProduit', () => {
  it('devrait calculer 100 sachets × 25g × 24% = 600g', () => {
    const result = calcPoidsModeProduit(100, 25, 0.24)
    expect(result).toBe(600)
  })

  it('devrait calculer 50 sachets × 30g × 100% = 1500g', () => {
    const result = calcPoidsModeProduit(50, 30, 1.0)
    expect(result).toBe(1500)
  })

  it('devrait gerer de petits pourcentages', () => {
    const result = calcPoidsModeProduit(100, 25, 0.05)
    expect(result).toBe(125)
  })
})

// ============================================================
// Calcul pourcentages mode melange
// ============================================================

describe('calcPourcentagesMelange', () => {
  it('devrait calculer [300, 200, 500] → [0.30, 0.20, 0.50]', () => {
    const result = calcPourcentagesMelange([300, 200, 500])
    expect(result).toEqual([0.30, 0.20, 0.50])
  })

  it('devrait sommer a 1.0 (tolerance arrondi)', () => {
    const result = calcPourcentagesMelange([333, 333, 334])
    const sum = result.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01)
  })

  it('devrait gerer un seul ingredient (100%)', () => {
    const result = calcPourcentagesMelange([500])
    expect(result).toEqual([1.0])
  })

  it('devrait gerer des poids a zero', () => {
    const result = calcPourcentagesMelange([0, 0, 0])
    expect(result).toEqual([0, 0, 0])
  })
})

// ============================================================
// Stock net produit fini
// ============================================================

describe('calcStockNetProduitFini', () => {
  it('devrait calculer entrees [100, 50] - sorties [30] = 120 sachets', () => {
    const result = calcStockNetProduitFini([
      { type: 'entree', quantite: 100 },
      { type: 'entree', quantite: 50 },
      { type: 'sortie', quantite: 30 },
    ])
    expect(result).toBe(120)
  })

  it('devrait retourner 0 pour aucun mouvement', () => {
    const result = calcStockNetProduitFini([])
    expect(result).toBe(0)
  })

  it('devrait gerer un stock negatif (sorties > entrees)', () => {
    const result = calcStockNetProduitFini([
      { type: 'entree', quantite: 10 },
      { type: 'sortie', quantite: 20 },
    ])
    expect(result).toBe(-10)
  })

  it('devrait gerer uniquement des entrees', () => {
    const result = calcStockNetProduitFini([
      { type: 'entree', quantite: 100 },
      { type: 'entree', quantite: 200 },
    ])
    expect(result).toBe(300)
  })

  it('devrait gerer uniquement des sorties', () => {
    const result = calcStockNetProduitFini([
      { type: 'sortie', quantite: 50 },
      { type: 'sortie', quantite: 30 },
    ])
    expect(result).toBe(-80)
  })
})
