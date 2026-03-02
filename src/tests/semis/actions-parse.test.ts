/**
 * Tests unitaires pour les helpers de parsing des Server Actions Semis.
 * Ces tests valident la transformation FormData → objet validé Zod,
 * notamment les conversions de type (boolean certif_ab, float poids, ints).
 * Aucune dépendance réseau : seul le parsing est testé.
 */

import { describe, it, expect } from 'vitest'

// Les parsers sont des fonctions pures extraites dans un fichier utilitaire :
// aucune dépendance serveur à mocker.
import { parseSeedLotForm, parseSeedlingForm } from '@/lib/utils/semis-parsers'

// ---- Helpers de test ----

/** Construit un FormData à partir d'un objet clé-valeur */
function makeFormData(obj: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    fd.append(key, value)
  }
  return fd
}

/** Retourne une date YYYY-MM-DD relative à aujourd'hui */
function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const YESTERDAY = relativeDate(-1)
const TOMORROW = relativeDate(1)

// UUIDs v4 valides (RFC 4122 strict, requis par Zod v4)
const VARIETY_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

// ============================================================
// parseSeedLotForm
// ============================================================

describe('parseSeedLotForm', () => {
  describe('cas valides', () => {
    it('devrait parser un formulaire minimal valide', () => {
      const fd = makeFormData({ variety_id: VARIETY_UUID, date_achat: YESTERDAY })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data.variety_id).toBe(VARIETY_UUID)
        expect(result.data.date_achat).toBe(YESTERDAY)
        // certif_ab false par défaut
        expect(result.data.certif_ab).toBe(false)
        // champs optionnels absents → null
        expect(result.data.fournisseur).toBeNull()
        expect(result.data.poids_sachet_g).toBeNull()
      }
    })

    it('devrait convertir certif_ab = "on" en true (valeur envoyée par les checkboxes HTML)', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        certif_ab: 'on',
      })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.certif_ab).toBe(true)
    })

    it('devrait convertir certif_ab = "true" en true (valeur envoyée programmatiquement)', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        certif_ab: 'true',
      })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.certif_ab).toBe(true)
    })

    it('devrait retourner certif_ab = false quand la clé est absente', () => {
      const fd = makeFormData({ variety_id: VARIETY_UUID, date_achat: YESTERDAY })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.certif_ab).toBe(false)
    })

    it('devrait convertir poids_sachet_g en float', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        poids_sachet_g: '2.50',
      })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) expect(result.data.poids_sachet_g).toBe(2.5)
    })

    it('devrait normaliser les champs string optionnels vides en null', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        fournisseur: '',
        numero_facture: '  ',   // espaces → trim → null
        commentaire: '',
      })
      const result = parseSeedLotForm(fd)
      expect('data' in result).toBe(true)
      if ('data' in result) {
        expect(result.data.fournisseur).toBeNull()
        expect(result.data.numero_facture).toBeNull()
        expect(result.data.commentaire).toBeNull()
      }
    })
  })

  describe('cas invalides', () => {
    it('devrait retourner { error } si variety_id est absent', () => {
      const fd = makeFormData({ date_achat: YESTERDAY })
      const result = parseSeedLotForm(fd)
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si variety_id est un UUID invalide', () => {
      const fd = makeFormData({ variety_id: 'pas-un-uuid', date_achat: YESTERDAY })
      const result = parseSeedLotForm(fd)
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toContain('variety_id')
    })

    it('devrait retourner { error } si date_achat est dans le futur', () => {
      const fd = makeFormData({ variety_id: VARIETY_UUID, date_achat: TOMORROW })
      const result = parseSeedLotForm(fd)
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error).toContain('date_achat')
    })

    it('devrait retourner { error } si poids_sachet_g est négatif', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        poids_sachet_g: '-1',
      })
      const result = parseSeedLotForm(fd)
      expect('error' in result).toBe(true)
    })

    it('devrait retourner { error } si poids_sachet_g a plus de 2 décimales', () => {
      const fd = makeFormData({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        poids_sachet_g: '1.555',
      })
      const result = parseSeedLotForm(fd)
      expect('error' in result).toBe(true)
    })
  })
})

// ============================================================
// parseSeedlingForm — processus mini_motte
// ============================================================

describe('parseSeedlingForm — processus mini_motte', () => {
  it('devrait parser un semis mini-motte minimal valide', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.processus).toBe('mini_motte')
      expect(result.data.nb_mottes).toBe(50)
    }
  })

  it('devrait mettre à null les champs caissette_godet pour le processus mini_motte', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_mottes: '50',
      // Ces champs ne doivent pas être pris en compte
      nb_caissettes: '3',
      nb_plants_caissette: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.nb_caissettes).toBeNull()
      expect(result.data.nb_plants_caissette).toBeNull()
      expect(result.data.nb_godets).toBeNull()
      expect(result.data.date_repiquage).toBeNull()
    }
  })

  it('devrait defaulter nb_mortes_mottes à 0 quand le champ est absent', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) expect(result.data.nb_mortes_mottes).toBe(0)
  })

  it('devrait envoyer 0 (pas null) pour nb_mortes_caissette et nb_mortes_godet en mini_motte', () => {
    // Ces colonnes sont NOT NULL DEFAULT 0 en base — on doit envoyer 0
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.nb_mortes_caissette).toBe(0)
      expect(result.data.nb_mortes_godet).toBe(0)
    }
  })

  it('devrait retourner { error } si nb_mottes est absent en processus mini_motte', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('nb_mottes')
  })
})

// ============================================================
// parseSeedlingForm — processus caissette_godet
// ============================================================

describe('parseSeedlingForm — processus caissette_godet', () => {
  it('devrait parser un semis caissette/godet minimal valide', () => {
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_caissettes: '3',
      nb_plants_caissette: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.processus).toBe('caissette_godet')
      expect(result.data.nb_caissettes).toBe(3)
      expect(result.data.nb_plants_caissette).toBe(50)
    }
  })

  it('devrait mettre à null les champs mini_motte pour le processus caissette_godet', () => {
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_caissettes: '3',
      nb_plants_caissette: '50',
      // Ces champs ne doivent pas être pris en compte
      nb_mottes: '98',
      numero_caisse: 'A',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.nb_mottes).toBeNull()
      expect(result.data.numero_caisse).toBeNull()
    }
  })

  it('devrait defaulter nb_mortes_caissette et nb_mortes_godet à 0 quand absents', () => {
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_caissettes: '3',
      nb_plants_caissette: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.nb_mortes_caissette).toBe(0)
      expect(result.data.nb_mortes_godet).toBe(0)
    }
  })

  it('devrait envoyer 0 (pas null) pour nb_mortes_mottes en caissette_godet', () => {
    // Cette colonne est NOT NULL DEFAULT 0 en base — on doit envoyer 0
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_caissettes: '3',
      nb_plants_caissette: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('data' in result).toBe(true)
    if ('data' in result) expect(result.data.nb_mortes_mottes).toBe(0)
  })

  it('devrait retourner { error } si nb_caissettes est absent en processus caissette_godet', () => {
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_plants_caissette: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si nb_plants_caissette est absent en processus caissette_godet', () => {
    const fd = makeFormData({
      processus: 'caissette_godet',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_caissettes: '3',
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
  })
})

// ============================================================
// parseSeedlingForm — cas invalides communs
// ============================================================

describe('parseSeedlingForm — cas invalides communs', () => {
  it('devrait retourner { error } si processus est absent', () => {
    const fd = makeFormData({
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si processus est une valeur inconnue', () => {
    const fd = makeFormData({
      processus: 'inconnu',
      variety_id: VARIETY_UUID,
      date_semis: YESTERDAY,
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si variety_id est absent', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      date_semis: YESTERDAY,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
  })

  it('devrait retourner { error } si date_semis est dans le futur', () => {
    const fd = makeFormData({
      processus: 'mini_motte',
      variety_id: VARIETY_UUID,
      date_semis: TOMORROW,
      nb_mottes: '50',
    })
    const result = parseSeedlingForm(fd)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('date_semis')
  })
})
