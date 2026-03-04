import { describe, it, expect } from 'vitest'
import {
  soilWorkSchema,
  plantingSchema,
  rowCareSchema,
  harvestSchema,
  uprootingSchema,
  occultationSchema,
} from '@/lib/validation/parcelles'

// ---- Helpers ----

function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const TODAY = relativeDate(0)
const YESTERDAY = relativeDate(-1)
const TOMORROW = relativeDate(1)

// UUIDs v4 valides (format RFC 4122 strict)
const ROW_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const VARIETY_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const SEEDLING_UUID = 'b7e2c3d4-1234-4abc-8def-0a1b2c3d4e5f'

// ---- Tests soilWorkSchema ----

describe('soilWorkSchema', () => {
  describe('cas valides', () => {
    it('devrait accepter un travail de sol minimal valide', () => {
      const result = soilWorkSchema.safeParse({
        row_id: ROW_UUID,
        date: YESTERDAY,
        type_travail: 'depaillage',
      })
      expect(result.success).toBe(true)
    })

    it('devrait accepter tous les types de travaux', () => {
      const types = ['depaillage', 'motoculteur', 'amendement', 'autre'] as const
      for (const t of types) {
        const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY, type_travail: t })
        expect(result.success).toBe(true)
      }
    })

    it("devrait accepter la date d'aujourd'hui", () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: TODAY, type_travail: 'motoculteur' })
      expect(result.success).toBe(true)
    })

    it('devrait accepter temps_min valide', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY, type_travail: 'amendement', temps_min: 30 })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand row_id est absent', () => {
      const result = soilWorkSchema.safeParse({ date: YESTERDAY, type_travail: 'depaillage' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand row_id est un UUID invalide', () => {
      const result = soilWorkSchema.safeParse({ row_id: 'pas-un-uuid', date: YESTERDAY, type_travail: 'depaillage' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date est dans le futur', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: TOMORROW, type_travail: 'depaillage' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date')
      }
    })

    it('devrait rejeter quand type_travail est absent', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand type_travail est une valeur inconnue', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY, type_travail: 'inconnu' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min = 0', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY, type_travail: 'depaillage', temps_min: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min négatif', () => {
      const result = soilWorkSchema.safeParse({ row_id: ROW_UUID, date: YESTERDAY, type_travail: 'depaillage', temps_min: -5 })
      expect(result.success).toBe(false)
    })
  })
})

// ---- Tests plantingSchema ----

describe('plantingSchema', () => {
  const BASE = {
    row_id: ROW_UUID,
    variety_id: VARIETY_UUID,
    annee: 2025,
    date_plantation: YESTERDAY,
    type_plant: 'godet',
  }

  describe('cas valides', () => {
    it('devrait accepter une plantation minimale valide', () => {
      const result = plantingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter une plantation avec seedling_id (sans fournisseur)', () => {
      const result = plantingSchema.safeParse({ ...BASE, seedling_id: SEEDLING_UUID })
      expect(result.success).toBe(true)
    })

    it('devrait accepter une plantation avec fournisseur (sans seedling_id)', () => {
      const result = plantingSchema.safeParse({ ...BASE, fournisseur: 'Les Tilleuls', type_plant: 'plant_achete' })
      expect(result.success).toBe(true)
    })

    it('devrait accepter une plantation sans seedling_id et sans fournisseur', () => {
      const result = plantingSchema.safeParse({ ...BASE, type_plant: 'division' })
      expect(result.success).toBe(true)
    })

    it('devrait appliquer certif_ab = false par défaut', () => {
      const result = plantingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.certif_ab).toBe(false)
    })

    it('devrait accepter tous les types de plants', () => {
      const types = ['godet', 'caissette', 'mini_motte', 'plant_achete', 'division', 'bouture', 'marcottage', 'stolon', 'rhizome', 'semis_direct'] as const
      for (const t of types) {
        const result = plantingSchema.safeParse({ ...BASE, type_plant: t })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand row_id est absent', () => {
      const { row_id: _, ...rest } = BASE
      const result = plantingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand variety_id est absent', () => {
      const { variety_id: _, ...rest } = BASE
      const result = plantingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date_plantation est dans le futur', () => {
      const result = plantingSchema.safeParse({ ...BASE, date_plantation: TOMORROW })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date_plantation')
      }
    })

    it('devrait rejeter quand type_plant est absent', () => {
      const { type_plant: _, ...rest } = BASE
      const result = plantingSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand seedling_id et fournisseur sont tous deux renseignés', () => {
      const result = plantingSchema.safeParse({
        ...BASE,
        seedling_id: SEEDLING_UUID,
        fournisseur: 'Les Tilleuls',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('seedling_id')
        expect(paths).toContain('fournisseur')
      }
    })

    it('devrait rejeter nb_plants = 0', () => {
      const result = plantingSchema.safeParse({ ...BASE, nb_plants: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter espacement_cm négatif', () => {
      const result = plantingSchema.safeParse({ ...BASE, espacement_cm: -10 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter longueur_m avec plus de 2 décimales', () => {
      const result = plantingSchema.safeParse({ ...BASE, longueur_m: 10.555 })
      expect(result.success).toBe(false)
    })
  })
})

// ---- Tests rowCareSchema ----

describe('rowCareSchema', () => {
  const BASE = {
    row_id: ROW_UUID,
    variety_id: VARIETY_UUID,
    date: YESTERDAY,
    type_soin: 'desherbage',
  }

  describe('cas valides', () => {
    it('devrait accepter un suivi de rang minimal valide', () => {
      const result = rowCareSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter tous les types de soins', () => {
      const types = ['desherbage', 'paillage', 'arrosage', 'autre'] as const
      for (const t of types) {
        const result = rowCareSchema.safeParse({ ...BASE, type_soin: t })
        expect(result.success).toBe(true)
      }
    })

    it('devrait accepter avec temps_min valide', () => {
      const result = rowCareSchema.safeParse({ ...BASE, temps_min: 45 })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand row_id est absent', () => {
      const { row_id: _, ...rest } = BASE
      const result = rowCareSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand variety_id est un UUID invalide', () => {
      const result = rowCareSchema.safeParse({ ...BASE, variety_id: 'pas-un-uuid' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date est dans le futur', () => {
      const result = rowCareSchema.safeParse({ ...BASE, date: TOMORROW })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand type_soin est une valeur inconnue', () => {
      const result = rowCareSchema.safeParse({ ...BASE, type_soin: 'inconnu' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min = 0', () => {
      const result = rowCareSchema.safeParse({ ...BASE, temps_min: 0 })
      expect(result.success).toBe(false)
    })
  })
})

// ---- Tests harvestSchema ----

describe('harvestSchema', () => {
  const BASE_PARCELLE = {
    type_cueillette: 'parcelle',
    variety_id: VARIETY_UUID,
    partie_plante: 'feuille',
    date: YESTERDAY,
    poids_g: 500.5,
    row_id: ROW_UUID,
  }

  const BASE_SAUVAGE = {
    type_cueillette: 'sauvage',
    variety_id: VARIETY_UUID,
    partie_plante: 'fleur',
    date: YESTERDAY,
    poids_g: 250,
    lieu_sauvage: 'Bord de la rivière',
  }

  describe('cueillette en parcelle — cas valides', () => {
    it('devrait accepter une cueillette en parcelle valide', () => {
      const result = harvestSchema.safeParse(BASE_PARCELLE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter toutes les parties de plante', () => {
      const parts = ['feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere'] as const
      for (const p of parts) {
        const result = harvestSchema.safeParse({ ...BASE_PARCELLE, partie_plante: p })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('cueillette sauvage — cas valides', () => {
    it('devrait accepter une cueillette sauvage valide', () => {
      const result = harvestSchema.safeParse(BASE_SAUVAGE)
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides — communs', () => {
    it('devrait rejeter quand variety_id est absent', () => {
      const { variety_id: _, ...rest } = BASE_PARCELLE
      const result = harvestSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand poids_g <= 0', () => {
      const result = harvestSchema.safeParse({ ...BASE_PARCELLE, poids_g: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand poids_g a plus de 2 décimales', () => {
      const result = harvestSchema.safeParse({ ...BASE_PARCELLE, poids_g: 100.555 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand partie_plante est invalide', () => {
      const result = harvestSchema.safeParse({ ...BASE_PARCELLE, partie_plante: 'tige' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date est dans le futur', () => {
      const result = harvestSchema.safeParse({ ...BASE_PARCELLE, date: TOMORROW })
      expect(result.success).toBe(false)
    })
  })

  describe('validations conditionnelles parcelle vs sauvage', () => {
    it('devrait rejeter une cueillette en parcelle sans row_id', () => {
      const { row_id: _, ...rest } = BASE_PARCELLE
      const result = harvestSchema.safeParse(rest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('row_id')
      }
    })

    it('devrait rejeter une cueillette en parcelle avec lieu_sauvage renseigné', () => {
      const result = harvestSchema.safeParse({ ...BASE_PARCELLE, lieu_sauvage: 'Forêt' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('lieu_sauvage')
      }
    })

    it('devrait rejeter une cueillette sauvage sans lieu_sauvage', () => {
      const { lieu_sauvage: _, ...rest } = BASE_SAUVAGE
      const result = harvestSchema.safeParse(rest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('lieu_sauvage')
      }
    })

    it('devrait rejeter une cueillette sauvage avec row_id renseigné', () => {
      const result = harvestSchema.safeParse({ ...BASE_SAUVAGE, row_id: ROW_UUID })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('row_id')
      }
    })
  })
})

// ---- Tests uprootingSchema ----

describe('uprootingSchema', () => {
  const BASE = {
    row_id: ROW_UUID,
    date: YESTERDAY,
  }

  describe('cas valides', () => {
    it('devrait accepter un arrachage minimal valide (tout le rang)', () => {
      const result = uprootingSchema.safeParse(BASE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter un arrachage avec variety_id (variété spécifique)', () => {
      const result = uprootingSchema.safeParse({ ...BASE, variety_id: VARIETY_UUID })
      expect(result.success).toBe(true)
    })

    it('devrait accepter un arrachage avec temps_min', () => {
      const result = uprootingSchema.safeParse({ ...BASE, temps_min: 60 })
      expect(result.success).toBe(true)
    })
  })

  describe('cas invalides', () => {
    it('devrait rejeter quand row_id est absent', () => {
      const result = uprootingSchema.safeParse({ date: YESTERDAY })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand row_id est un UUID invalide', () => {
      const result = uprootingSchema.safeParse({ row_id: 'pas-un-uuid', date: YESTERDAY })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date est dans le futur', () => {
      const result = uprootingSchema.safeParse({ ...BASE, date: TOMORROW })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter variety_id non-UUID', () => {
      const result = uprootingSchema.safeParse({ ...BASE, variety_id: 'pas-un-uuid' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min = 0', () => {
      const result = uprootingSchema.safeParse({ ...BASE, temps_min: 0 })
      expect(result.success).toBe(false)
    })
  })
})

// ---- Tests occultationSchema ----

describe('occultationSchema', () => {
  const BASE_PAILLE = {
    row_id: ROW_UUID,
    date_debut: YESTERDAY,
    methode: 'paille',
    fournisseur: 'Ferme voisine',
  }

  const BASE_FOIN = {
    row_id: ROW_UUID,
    date_debut: YESTERDAY,
    methode: 'foin',
    fournisseur: 'Agriculteur local',
  }

  const BASE_BACHE = {
    row_id: ROW_UUID,
    date_debut: YESTERDAY,
    methode: 'bache',
  }

  const BASE_ENGRAIS = {
    row_id: ROW_UUID,
    date_debut: YESTERDAY,
    methode: 'engrais_vert',
    engrais_vert_nom: 'Moutarde blanche',
    engrais_vert_fournisseur: 'Bio Sem',
  }

  describe('méthode paille — cas valides', () => {
    it('devrait accepter une occultation paille valide', () => {
      const result = occultationSchema.safeParse(BASE_PAILLE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter paille avec attestation', () => {
      const result = occultationSchema.safeParse({ ...BASE_PAILLE, attestation: 'Cert-AB-2025' })
      expect(result.success).toBe(true)
    })
  })

  describe('méthode foin — cas valides', () => {
    it('devrait accepter une occultation foin valide', () => {
      const result = occultationSchema.safeParse(BASE_FOIN)
      expect(result.success).toBe(true)
    })
  })

  describe('méthode bâche — cas valides', () => {
    it('devrait accepter une occultation bâche valide', () => {
      const result = occultationSchema.safeParse(BASE_BACHE)
      expect(result.success).toBe(true)
    })

    it('devrait accepter bâche avec temps_retrait_min', () => {
      const result = occultationSchema.safeParse({ ...BASE_BACHE, temps_retrait_min: 30 })
      expect(result.success).toBe(true)
    })
  })

  describe('méthode engrais vert — cas valides', () => {
    it('devrait accepter une occultation engrais vert valide', () => {
      const result = occultationSchema.safeParse(BASE_ENGRAIS)
      expect(result.success).toBe(true)
    })

    it('devrait appliquer engrais_vert_certif_ab = false par défaut', () => {
      const result = occultationSchema.safeParse(BASE_ENGRAIS)
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.engrais_vert_certif_ab).toBe(false)
    })
  })

  describe('date_fin >= date_debut', () => {
    it('devrait accepter date_fin >= date_debut', () => {
      const result = occultationSchema.safeParse({ ...BASE_BACHE, date_fin: TODAY })
      expect(result.success).toBe(true)
    })

    it('devrait rejeter date_fin < date_debut', () => {
      const result = occultationSchema.safeParse({
        ...BASE_BACHE,
        date_debut: TODAY,
        date_fin: YESTERDAY,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('date_fin')
      }
    })
  })

  describe('validations conditionnelles par méthode', () => {
    it('devrait rejeter paille sans fournisseur', () => {
      const result = occultationSchema.safeParse({ row_id: ROW_UUID, date_debut: YESTERDAY, methode: 'paille' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('fournisseur')
      }
    })

    it('devrait rejeter foin sans fournisseur', () => {
      const result = occultationSchema.safeParse({ row_id: ROW_UUID, date_debut: YESTERDAY, methode: 'foin' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('fournisseur')
      }
    })

    it('devrait rejeter engrais_vert sans engrais_vert_nom', () => {
      const result = occultationSchema.safeParse({
        row_id: ROW_UUID,
        date_debut: YESTERDAY,
        methode: 'engrais_vert',
        engrais_vert_fournisseur: 'Bio Sem',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('engrais_vert_nom')
      }
    })

    it('devrait rejeter engrais_vert sans engrais_vert_fournisseur', () => {
      const result = occultationSchema.safeParse({
        row_id: ROW_UUID,
        date_debut: YESTERDAY,
        methode: 'engrais_vert',
        engrais_vert_nom: 'Moutarde blanche',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'))
        expect(paths).toContain('engrais_vert_fournisseur')
      }
    })
  })

  describe('cas invalides — communs', () => {
    it('devrait rejeter quand row_id est absent', () => {
      const result = occultationSchema.safeParse({ date_debut: YESTERDAY, methode: 'bache' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand date_debut est dans le futur', () => {
      const result = occultationSchema.safeParse({ ...BASE_BACHE, date_debut: TOMORROW })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter quand methode est une valeur inconnue', () => {
      const result = occultationSchema.safeParse({ row_id: ROW_UUID, date_debut: YESTERDAY, methode: 'beton' })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_min = 0', () => {
      const result = occultationSchema.safeParse({ ...BASE_BACHE, temps_min: 0 })
      expect(result.success).toBe(false)
    })

    it('devrait rejeter temps_retrait_min négatif', () => {
      const result = occultationSchema.safeParse({ ...BASE_BACHE, temps_retrait_min: -10 })
      expect(result.success).toBe(false)
    })
  })
})
