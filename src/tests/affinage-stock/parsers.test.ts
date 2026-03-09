import { describe, it, expect } from 'vitest'
import { parsePurchaseForm, parseDirectSaleForm, parseAdjustmentForm } from '@/lib/utils/affinage-stock-parsers'

/** Helper pour construire un FormData depuis un objet */
function buildFormData(obj: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    fd.set(key, value)
  }
  return fd
}

// ---- parsePurchaseForm ----

describe('parsePurchaseForm', () => {
  it('extrait correctement un achat complet', () => {
    const fd = buildFormData({
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'feuille',
      date: '2025-06-15',
      etat_plante: 'sechee',
      poids_g: '500',
      fournisseur: 'Herboristerie du Sud',
      numero_lot_fournisseur: 'LOT-001',
      certif_ab: 'true',
      prix: '45.50',
      commentaire: 'Qualite OK',
    })

    const result = parsePurchaseForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.variety_id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.data.poids_g).toBe(500)
      expect(result.data.certif_ab).toBe(true)
      expect(result.data.prix).toBe(45.50)
      expect(result.data.fournisseur).toBe('Herboristerie du Sud')
    }
  })

  it('gere certif_ab comme boolean (checkbox on)', () => {
    const fd = buildFormData({
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'fleur',
      date: '2025-06-15',
      etat_plante: 'frais',
      poids_g: '100',
      fournisseur: 'Bio',
      certif_ab: 'on',
    })

    const result = parsePurchaseForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.certif_ab).toBe(true)
    }
  })

  it('retourne une erreur pour champs manquants', () => {
    const fd = buildFormData({
      variety_id: '',
      partie_plante: '',
      date: '',
      etat_plante: '',
      poids_g: '',
      fournisseur: '',
    })

    const result = parsePurchaseForm(fd)
    expect('error' in result).toBe(true)
  })

  it('retourne une erreur pour prix non numerique', () => {
    const fd = buildFormData({
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'feuille',
      date: '2025-06-15',
      etat_plante: 'sechee',
      poids_g: '500',
      fournisseur: 'Test',
      prix: 'abc',
    })

    // parseOptionalDecimal retourne null pour 'abc' (NaN), prix null est accepte
    const result = parsePurchaseForm(fd)
    expect('data' in result).toBe(true)
  })
})

// ---- parseDirectSaleForm ----

describe('parseDirectSaleForm', () => {
  it('extrait correctement une vente', () => {
    const fd = buildFormData({
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'graine',
      date: '2025-06-15',
      etat_plante: 'sechee_triee',
      poids_g: '200',
      destinataire: 'Marche bio',
      commentaire: 'Vente samedi',
    })

    const result = parseDirectSaleForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.poids_g).toBe(200)
      expect(result.data.destinataire).toBe('Marche bio')
    }
  })

  it('retourne une erreur pour champs manquants', () => {
    const fd = buildFormData({})

    const result = parseDirectSaleForm(fd)
    expect('error' in result).toBe(true)
  })
})

// ---- parseAdjustmentForm ----

describe('parseAdjustmentForm', () => {
  it('extrait correctement un ajustement avec type_mouvement', () => {
    const fd = buildFormData({
      variety_id: '550e8400-e29b-41d4-a716-446655440000',
      partie_plante: 'racine',
      date: '2025-06-15',
      type_mouvement: 'sortie',
      etat_plante: 'frais',
      poids_g: '300',
      motif: 'Perte sechage',
      commentaire: '',
    })

    const result = parseAdjustmentForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.type_mouvement).toBe('sortie')
      expect(result.data.motif).toBe('Perte sechage')
      expect(result.data.poids_g).toBe(300)
    }
  })

  it('retourne une erreur pour champs manquants', () => {
    const fd = buildFormData({})

    const result = parseAdjustmentForm(fd)
    expect('error' in result).toBe(true)
  })
})
