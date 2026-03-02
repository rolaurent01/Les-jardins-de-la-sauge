import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { seedLotSchema, seedlingSchema } from '@/lib/validation/semis'

// ---- Helpers ----

/** Retourne une date YYYY-MM-DD relative à aujourd'hui */
function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const TODAY = relativeDate(0)
const YESTERDAY = relativeDate(-1)
const TOMORROW = relativeDate(1)

// UUIDs v4 valides (Zod v4 impose le format RFC 4122 strict : version 1-8, variante 8-b)
const VARIETY_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const SEED_LOT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

// ---- Tests seedLotSchema ----

describe('seedLotSchema', () => {
  describe('cas valides', () => {
    it('devrait accepter un lot minimal valide', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        certif_ab: false,
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un lot complet valide', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        fournisseur: 'Agrosemens',
        numero_lot_fournisseur: 'LOT-2025-XYZ',
        date_achat: YESTERDAY,
        date_facture: YESTERDAY,
        numero_facture: 'FAC-001',
        poids_sachet_g: 10.5,
        certif_ab: true,
        commentaire: 'Lot de qualité supérieure',
      })
      expect(result.success).toBe(true)
    })

    it("devrait accepter date_achat = aujourd'hui", () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: TODAY,
        certif_ab: false,
      })
      expect(result.success).toBe(true)
    })

    it('devrait appliquer certif_ab = false par défaut', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.certif_ab).toBe(false)
      }
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand variety_id est absent', () => {
      const result = seedLotSchema.safeParse({
        date_achat: YESTERDAY,
        certif_ab: false,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand variety_id est un UUID invalide', () => {
      const result = seedLotSchema.safeParse({
        variety_id: 'pas-un-uuid',
        date_achat: YESTERDAY,
        certif_ab: false,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date_achat est dans le futur', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: TOMORROW,
        certif_ab: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date_achat')
      }
    })

    it('devrait rejeter quand poids_sachet_g <= 0', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        poids_sachet_g: -5,
        certif_ab: false,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand poids_sachet_g a plus de 2 décimales', () => {
      const result = seedLotSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_achat: YESTERDAY,
        poids_sachet_g: 10.555,
        certif_ab: false,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ---- Tests seedlingSchema ----

describe('seedlingSchema', () => {
  describe('processus mini_motte — cas valides', () => {
    it('devrait accepter un semis mini-motte minimal valide', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_mottes: 98,
        nb_donnees: 0,
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un semis mini-motte complet valide', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        variety_id: VARIETY_UUID,
        seed_lot_id: SEED_LOT_UUID,
        date_semis: YESTERDAY,
        nb_mottes: 98,
        nb_mortes_mottes: 20,
        nb_donnees: 3,
        nb_plants_obtenus: 75,
        numero_caisse: 'A',
        poids_graines_utilise_g: 2.5,
        temps_semis_min: 45,
        commentaire: 'Semis hivernal',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('processus caissette_godet — cas valides', () => {
    it('devrait accepter un semis caissette/godet minimal valide', () => {
      const result = seedlingSchema.safeParse({
        processus: 'caissette_godet',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_caissettes: 1,
        nb_plants_caissette: 50,
        nb_donnees: 0,
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un semis caissette/godet complet valide', () => {
      const result = seedlingSchema.safeParse({
        processus: 'caissette_godet',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_caissettes: 1,
        nb_plants_caissette: 50,
        nb_mortes_caissette: 5,
        nb_godets: 45,
        nb_mortes_godet: 5,
        nb_donnees: 5,
        nb_plants_obtenus: 35,
        date_repiquage: YESTERDAY,
        temps_repiquage_min: 30,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides — communs', () => {
    it('devrait rejeter quand processus est absent', () => {
      const result = seedlingSchema.safeParse({
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_mottes: 50,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand processus est une valeur inconnue', () => {
      const result = seedlingSchema.safeParse({
        processus: 'inconnu',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand variety_id est absent', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        date_semis: YESTERDAY,
        nb_mottes: 50,
      })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date_semis est dans le futur', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        variety_id: VARIETY_UUID,
        date_semis: TOMORROW,
        nb_mottes: 50,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date_semis')
      }
    })

    it('devrait rejeter un seed_lot_id invalide (pas un UUID)', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        seed_lot_id: 'pas-un-uuid',
        nb_mottes: 50,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('cas invalides — champs conditionnels mini_motte', () => {
    it('devrait rejeter quand nb_mottes est absent en processus mini_motte', () => {
      const result = seedlingSchema.safeParse({
        processus: 'mini_motte',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        // nb_mottes absent
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('nb_mottes')
      }
    })
  })

  describe('cas invalides — champs conditionnels caissette_godet', () => {
    it('devrait rejeter quand nb_caissettes est absent en processus caissette_godet', () => {
      const result = seedlingSchema.safeParse({
        processus: 'caissette_godet',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_plants_caissette: 50,
        // nb_caissettes absent
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('nb_caissettes')
      }
    })

    it('devrait rejeter quand nb_plants_caissette est absent en processus caissette_godet', () => {
      const result = seedlingSchema.safeParse({
        processus: 'caissette_godet',
        variety_id: VARIETY_UUID,
        date_semis: YESTERDAY,
        nb_caissettes: 1,
        // nb_plants_caissette absent
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('nb_plants_caissette')
      }
    })
  })
})
