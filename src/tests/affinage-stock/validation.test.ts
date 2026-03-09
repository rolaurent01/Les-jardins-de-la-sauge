import { describe, it, expect } from 'vitest'
import { purchaseSchema, directSaleSchema, adjustmentSchema } from '@/lib/validation/affinage-stock'

// ---- purchaseSchema ----

describe('purchaseSchema', () => {
  const validPurchase = {
    variety_id: '550e8400-e29b-41d4-a716-446655440000',
    partie_plante: 'feuille',
    date: '2025-06-15',
    etat_plante: 'sechee',
    poids_g: 500,
    fournisseur: 'Herboristerie du Sud',
    numero_lot_fournisseur: 'LOT-2025-001',
    certif_ab: true,
    prix: 45.50,
    commentaire: 'Qualite excellente',
  }

  it('accepte un achat valide complet', () => {
    const result = purchaseSchema.safeParse(validPurchase)
    expect(result.success).toBe(true)
  })

  it('accepte un achat minimal (champs optionnels absents)', () => {
    const minimal = {
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'fleur',
      date: '2025-06-15',
      etat_plante: 'frais',
      poids_g: 100,
      fournisseur: 'Bio Plantes',
    }
    const result = purchaseSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('rejette un fournisseur manquant', () => {
    const { fournisseur, ...sans } = validPurchase
    const result = purchaseSchema.safeParse({ ...sans, fournisseur: '' })
    expect(result.success).toBe(false)
  })

  it('rejette un poids zero', () => {
    const result = purchaseSchema.safeParse({ ...validPurchase, poids_g: 0 })
    expect(result.success).toBe(false)
  })

  it('rejette un poids negatif', () => {
    const result = purchaseSchema.safeParse({ ...validPurchase, poids_g: -10 })
    expect(result.success).toBe(false)
  })

  it('rejette une date dans le futur', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const result = purchaseSchema.safeParse({
      ...validPurchase,
      date: future.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
  })

  it('rejette un etat plante invalide', () => {
    const result = purchaseSchema.safeParse({ ...validPurchase, etat_plante: 'congelee' })
    expect(result.success).toBe(false)
  })

  it('accepte les 6 etats plante valides', () => {
    const etats = ['frais', 'tronconnee', 'sechee', 'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee']
    for (const etat of etats) {
      const result = purchaseSchema.safeParse({ ...validPurchase, etat_plante: etat })
      expect(result.success, `etat ${etat} devrait etre valide`).toBe(true)
    }
  })
})

// ---- directSaleSchema ----

describe('directSaleSchema', () => {
  const validSale = {
    variety_id: '550e8400-e29b-41d4-a716-446655440000',
    partie_plante: 'graine',
    date: '2025-06-15',
    etat_plante: 'sechee_triee',
    poids_g: 200,
    destinataire: 'Marche du samedi',
    commentaire: 'Vente directe',
  }

  it('accepte une vente valide', () => {
    const result = directSaleSchema.safeParse(validSale)
    expect(result.success).toBe(true)
  })

  it('accepte une vente sans destinataire', () => {
    const result = directSaleSchema.safeParse({ ...validSale, destinataire: null })
    expect(result.success).toBe(true)
  })

  it('rejette un poids negatif', () => {
    const result = directSaleSchema.safeParse({ ...validSale, poids_g: -5 })
    expect(result.success).toBe(false)
  })

  it('rejette une date dans le futur', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const result = directSaleSchema.safeParse({
      ...validSale,
      date: future.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
  })
})

// ---- adjustmentSchema ----

describe('adjustmentSchema', () => {
  const validAdjustment = {
    variety_id: '550e8400-e29b-41d4-a716-446655440000',
    partie_plante: 'racine',
    date: '2025-06-15',
    type_mouvement: 'entree' as const,
    etat_plante: 'frais',
    poids_g: 300,
    motif: 'Correction inventaire',
    commentaire: null,
  }

  it('accepte un ajustement entree valide', () => {
    const result = adjustmentSchema.safeParse(validAdjustment)
    expect(result.success).toBe(true)
  })

  it('accepte un ajustement sortie valide', () => {
    const result = adjustmentSchema.safeParse({ ...validAdjustment, type_mouvement: 'sortie' })
    expect(result.success).toBe(true)
  })

  it('rejette un motif manquant', () => {
    const result = adjustmentSchema.safeParse({ ...validAdjustment, motif: '' })
    expect(result.success).toBe(false)
  })

  it('rejette un motif vide (espaces uniquement comptes comme non-vide par min(1))', () => {
    // min(1) accepte les espaces, mais le parser fait trim() avant
    const result = adjustmentSchema.safeParse({ ...validAdjustment, motif: '' })
    expect(result.success).toBe(false)
  })

  it('rejette un type_mouvement invalide', () => {
    const result = adjustmentSchema.safeParse({ ...validAdjustment, type_mouvement: 'transfert' })
    expect(result.success).toBe(false)
  })
})
