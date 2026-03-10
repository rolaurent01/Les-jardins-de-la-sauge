/**
 * Tests unitaires — cache-loader.ts
 * Chargement et validation du cache de référence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetDatabase, offlineDb } from './helpers/mock-db'
import { isCacheValid, clearReferenceCache } from '@/lib/offline/cache-loader'
import { saveOfflineContext } from '@/lib/offline/context-offline'

const FARM_ID = '00000000-0000-4000-a000-000000000001'
const OTHER_FARM_ID = '00000000-0000-4000-a000-000000000099'

beforeEach(async () => {
  await resetDatabase()
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────
// isCacheValid
// ─────────────────────────────────────────────────────────────

describe('isCacheValid', () => {
  it('même farmId que le contexte + lastSyncedAt renseigné → true', async () => {
    await saveOfflineContext({
      userId: 'user-1',
      farmId: FARM_ID,
      organizationId: 'org-1',
      orgSlug: 'ljs',
    })
    // Simuler un lastSyncedAt renseigné
    await offlineDb.context.update('current', { lastSyncedAt: new Date().toISOString() })

    const valid = await isCacheValid(FARM_ID)
    expect(valid).toBe(true)
  })

  it('farmId différent → false', async () => {
    await saveOfflineContext({
      userId: 'user-1',
      farmId: FARM_ID,
      organizationId: 'org-1',
      orgSlug: 'ljs',
    })
    await offlineDb.context.update('current', { lastSyncedAt: new Date().toISOString() })

    const valid = await isCacheValid(OTHER_FARM_ID)
    expect(valid).toBe(false)
  })

  it('pas de contexte en base → false', async () => {
    const valid = await isCacheValid(FARM_ID)
    expect(valid).toBe(false)
  })

  it('même farmId mais lastSyncedAt null → false', async () => {
    await saveOfflineContext({
      userId: 'user-1',
      farmId: FARM_ID,
      organizationId: 'org-1',
      orgSlug: 'ljs',
    })
    // lastSyncedAt reste null par défaut via saveOfflineContext

    const valid = await isCacheValid(FARM_ID)
    expect(valid).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// clearReferenceCache
// ─────────────────────────────────────────────────────────────

describe('clearReferenceCache', () => {
  it('vide les 7 stores de référence', async () => {
    // Remplir les stores avec des données
    await offlineDb.varieties.add({ id: '1', nom_vernaculaire: 'Menthe', nom_latin: null, famille: null, type_cycle: null, parties_utilisees: ['feuille'] })
    await offlineDb.sites.add({ id: '1', nom: 'Site A' })
    await offlineDb.parcels.add({ id: '1', site_id: '1', nom: 'Parcelle 1', code: 'P1' })
    await offlineDb.rows.add({ id: '1', parcel_id: '1', numero: '1', longueur_m: 10, largeur_m: 1, position_ordre: 1 })
    await offlineDb.recipes.add({ id: '1', nom: 'Tisane', category_id: null, poids_sachet_g: 30, actif: true })
    await offlineDb.seedLots.add({ id: '1', lot_interne: 'SL-2025-001', variety_id: '1' })
    await offlineDb.externalMaterials.add({ id: '1', nom: 'Sel', unite: 'g' })

    await clearReferenceCache()

    expect(await offlineDb.varieties.count()).toBe(0)
    expect(await offlineDb.sites.count()).toBe(0)
    expect(await offlineDb.parcels.count()).toBe(0)
    expect(await offlineDb.rows.count()).toBe(0)
    expect(await offlineDb.recipes.count()).toBe(0)
    expect(await offlineDb.seedLots.count()).toBe(0)
    expect(await offlineDb.externalMaterials.count()).toBe(0)
  })

  it('NE vide PAS syncQueue', async () => {
    await offlineDb.syncQueue.add({
      uuid_client: crypto.randomUUID(),
      farm_id: '00000000-0000-4000-a000-000000000001',
      table_cible: 'harvests',
      payload: { poids_g: 100 },
      status: 'pending',
      tentatives: 0,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: null,
    })

    await clearReferenceCache()

    expect(await offlineDb.syncQueue.count()).toBe(1)
  })

  it('NE vide PAS context', async () => {
    await saveOfflineContext({
      userId: 'user-1',
      farmId: FARM_ID,
      organizationId: 'org-1',
      orgSlug: 'ljs',
    })

    await clearReferenceCache()

    const ctx = await offlineDb.context.get('current')
    expect(ctx).toBeDefined()
    expect(ctx!.farmId).toBe(FARM_ID)
  })
})
