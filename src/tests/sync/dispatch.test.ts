/**
 * Tests du dispatch de sync (src/lib/sync/dispatch.ts)
 *
 * Couvre les scénarios critiques :
 * - Dispatch harvest → appelle RPC avec bons params
 * - Dispatch harvest → propage l'erreur Supabase
 * - Dispatch production_lot → génère numero_lot, charge recette, appelle RPC
 * - Dispatch production_lot → idempotence (uuid_client déjà existant)
 * - Dispatch production_lot → erreur recette introuvable
 * - Dispatch simple insert (soil_works) → upsert avec idempotence
 * - Dispatch seed_lot → génère lot_interne SL-YYYY-NNN
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

// Mock lots utils
vi.mock('@/lib/utils/lots', () => ({
  generateSeedLotNumber: (year: number, count: number) => `SL-${year}-${String(count + 1).padStart(3, '0')}`,
  generateProductionLotNumber: (code: string, date: Date) =>
    `${code}${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`,
  getRecipeCode: (name: string) => name.slice(0, 3).toUpperCase(),
}))

// Mock seedling statut (utilisé par dispatchSeedling/dispatchPlanting/dispatchUprooting)
vi.mock('@/lib/utils/seedling-statut', () => ({
  computeSeedlingStatut: () => 'en_culture',
}))

import { dispatchSyncEntry } from '@/lib/sync/dispatch'

// --- Helpers ---

function makeParams(table_cible: string, payload: Record<string, unknown> = {}) {
  return {
    table_cible: table_cible as Parameters<typeof dispatchSyncEntry>[0]['table_cible'],
    farm_id: 'farm-1',
    user_id: 'user-1',
    uuid_client: 'uuid-abc',
    payload,
  }
}

/** Crée un mock de chaîne fluide Supabase (from().select().eq().single() etc.) */
function mockChain(finalResult: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = (..._args: unknown[]) => chain
  chain.insert = self
  chain.upsert = self
  chain.update = self
  chain.eq = self
  chain.neq = self
  chain.in = self
  chain.like = self
  chain.is = self
  chain.not = self
  chain.order = self
  chain.limit = self
  chain.maybeSingle = () => Promise.resolve(finalResult)
  chain.single = () => Promise.resolve(finalResult)
  // Pour les requêtes avec count: 'exact', head: true
  chain.then = (resolve: (v: unknown) => void) => resolve(finalResult)
  return chain
}

// --- Tests ---

describe('dispatchSyncEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dispatch harvest (RPC)', () => {
    it('devrait appeler create_harvest_with_stock avec les bons paramètres', async () => {
      mockRpc.mockResolvedValue({ data: 'harvest-id-1', error: null })

      const result = await dispatchSyncEntry(makeParams('harvests', {
        type_cueillette: 'parcelle',
        row_id: 'row-1',
        variety_id: 'var-1',
        partie_plante: 'feuille',
        date: '2026-03-15',
        poids_g: 500,
        temps_min: 30,
        commentaire: 'Test',
      }))

      expect(result).toEqual({ server_id: 'harvest-id-1' })
      expect(mockRpc).toHaveBeenCalledWith('create_harvest_with_stock', expect.objectContaining({
        p_farm_id: 'farm-1',
        p_uuid_client: 'uuid-abc',
        p_variety_id: 'var-1',
        p_partie_plante: 'feuille',
        p_date: '2026-03-15',
        p_poids_g: 500,
        p_created_by: 'user-1',
      }))
    })

    it('devrait propager l\'erreur Supabase en cas d\'échec RPC', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'stock insuffisant' } })

      await expect(
        dispatchSyncEntry(makeParams('harvests', {
          type_cueillette: 'parcelle',
          variety_id: 'var-1',
          partie_plante: 'feuille',
          date: '2026-03-15',
          poids_g: 500,
        }))
      ).rejects.toThrow('stock insuffisant')
    })
  })

  describe('dispatch cutting (RPC)', () => {
    it('devrait appeler create_cutting_with_stock', async () => {
      mockRpc.mockResolvedValue({ data: 'cutting-id-1', error: null })

      const result = await dispatchSyncEntry(makeParams('cuttings', {
        variety_id: 'var-1',
        partie_plante: 'feuille',
        type: 'frais',
        date: '2026-03-15',
        poids_g: 200,
      }))

      expect(result).toEqual({ server_id: 'cutting-id-1' })
      expect(mockRpc).toHaveBeenCalledWith('create_cutting_with_stock', expect.objectContaining({
        p_farm_id: 'farm-1',
        p_type: 'frais',
      }))
    })
  })

  describe('dispatch production_lot (complexe)', () => {
    it('devrait générer le numéro de lot et appeler la RPC', async () => {
      // Mock from('recipes').select().eq().eq().single()
      const recipeMock = mockChain({ data: { id: 'rec-1', nom: 'Tisane Menthe', poids_sachet_g: 30 }, error: null })
      // Mock from('production_lots') — existants pour unicité
      const existingLotsMock = mockChain({ data: [], error: null })
      // Mock from('recipe_ingredients')
      const ingredientsMock = mockChain({
        data: [{ variety_id: 'var-1', external_material_id: null, etat_plante: 'sec', partie_plante: 'feuille', pourcentage: 100, ordre: 1 }],
        error: null,
      })
      // Mock from('production_lots') — idempotence check
      const idempotenceMock = mockChain({ data: null, error: { code: 'PGRST116' } })

      let fromCallCount = 0
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++
        if (table === 'recipes') return recipeMock
        if (table === 'production_lots' && fromCallCount <= 3) return existingLotsMock
        if (table === 'recipe_ingredients') return ingredientsMock
        if (table === 'production_lots') return idempotenceMock
        return mockChain({ data: null, error: null })
      })

      // RPC finale
      mockRpc.mockResolvedValue({ data: 'lot-id-1', error: null })

      const result = await dispatchSyncEntry(makeParams('production_lots', {
        recipe_id: 'rec-1',
        mode: 'produit',
        date_production: '2026-03-15',
        nb_unites: 10,
        poids_total_g: 300,
      }))

      expect(result).toEqual({ server_id: 'lot-id-1' })
      expect(mockRpc).toHaveBeenCalledWith('create_production_lot_with_stock', expect.objectContaining({
        p_farm_id: 'farm-1',
        p_recipe_id: 'rec-1',
        p_mode: 'produit',
        p_nb_unites: 10,
        p_created_by: 'user-1',
      }))
    })

    it('devrait retourner l\'id existant si uuid_client déjà traité (idempotence)', async () => {
      const recipeMock = mockChain({ data: { id: 'rec-1', nom: 'Tisane', poids_sachet_g: 30 }, error: null })
      const existingLotsMock = mockChain({ data: [], error: null })
      const ingredientsMock = mockChain({
        data: [{ variety_id: 'var-1', external_material_id: null, etat_plante: 'sec', partie_plante: 'feuille', pourcentage: 100, ordre: 1 }],
        error: null,
      })

      let productionLotsCallCount = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === 'recipes') return recipeMock
        if (table === 'recipe_ingredients') return ingredientsMock
        if (table === 'production_lots') {
          productionLotsCallCount++
          // 1er appel : unicité du numéro de lot
          if (productionLotsCallCount === 1) return existingLotsMock
          // 2e appel : idempotence check → uuid_client existe déjà
          return mockChain({ data: { id: 'existing-lot-id' }, error: null })
        }
        return mockChain({ data: null, error: null })
      })

      const result = await dispatchSyncEntry(makeParams('production_lots', {
        recipe_id: 'rec-1',
        mode: 'produit',
        date_production: '2026-03-15',
        nb_unites: 5,
      }))

      expect(result).toEqual({ server_id: 'existing-lot-id' })
      // RPC ne devrait PAS avoir été appelée
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('devrait lever une erreur si la recette est introuvable', async () => {
      mockFrom.mockImplementation(() => mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }))

      await expect(
        dispatchSyncEntry(makeParams('production_lots', {
          recipe_id: 'rec-inexistant',
          mode: 'produit',
          date_production: '2026-03-15',
          nb_unites: 5,
        }))
      ).rejects.toThrow('Recette introuvable')
    })
  })

  describe('dispatch simple insert (soil_works)', () => {
    it('devrait faire un upsert avec uuid_client', async () => {
      const upsertChain = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'sw-1' }, error: null }),
      }
      mockFrom.mockReturnValue(upsertChain)

      const result = await dispatchSyncEntry(makeParams('soil_works', {
        row_id: 'row-1',
        type_travail: 'desherbage',
        date: '2026-03-15',
      }))

      expect(result).toEqual({ server_id: 'sw-1' })
      expect(mockFrom).toHaveBeenCalledWith('soil_works')
    })
  })

  describe('dispatch seed_lot', () => {
    it('devrait générer lot_interne et insérer', async () => {
      let fromCallCount = 0
      mockFrom.mockImplementation(() => {
        fromCallCount++
        // 1er appel : idempotence check → pas trouvé
        if (fromCallCount === 1) return mockChain({ data: null, error: { code: 'PGRST116' } })
        // 2e appel : count des lots existants
        if (fromCallCount === 2) return mockChain({ data: null, error: null, count: 3 })
        // 3e appel : insert
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'sl-1' }, error: null }),
            }),
          }),
        }
      })

      const result = await dispatchSyncEntry(makeParams('seed_lots', {
        variety_id: 'var-1',
        fournisseur: 'Agrosemens',
        date_achat: '2026-03-01',
      }))

      expect(result).toEqual({ server_id: 'sl-1' })
    })
  })
})
