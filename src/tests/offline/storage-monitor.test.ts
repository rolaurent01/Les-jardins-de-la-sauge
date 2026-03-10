/**
 * Tests unitaires — storage-monitor.ts
 * Monitoring du stockage IndexedDB et purge automatique.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetDatabase, offlineDb } from './helpers/mock-db'
import { getStorageEstimate, checkAndPurgeIfNeeded } from '@/lib/offline/storage-monitor'

beforeEach(async () => {
  await resetDatabase()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────
// getStorageEstimate
// ─────────────────────────────────────────────────────────────

describe('getStorageEstimate', () => {
  it('retourne usageBytes, quotaBytes, usagePercent, formatté', async () => {
    // Simuler navigator.storage.estimate
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 10_000_000, quota: 50_000_000 }),
      },
    })

    const estimate = await getStorageEstimate()
    expect(estimate.usageBytes).toBe(10_000_000)
    expect(estimate.quotaBytes).toBe(50_000_000)
    expect(estimate.usagePercent).toBe(20)
    expect(estimate.usageFormatted).toBeTruthy()
    expect(estimate.quotaFormatted).toBeTruthy()
  })

  it('fallback si navigator.storage n\'est pas disponible', async () => {
    vi.stubGlobal('navigator', {})

    const estimate = await getStorageEstimate()
    expect(estimate.usageBytes).toBe(0)
    expect(estimate.quotaBytes).toBe(50_000_000) // fallback 50 Mo
    expect(estimate.usagePercent).toBe(0)
  })

  it('formatage correct : bytes → Ko / Mo', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 1_500_000, quota: 50_000_000 }),
      },
    })

    const estimate = await getStorageEstimate()
    // 1.5 Mo environ → devrait contenir "Mo"
    expect(estimate.usageFormatted).toContain('Mo')
    expect(estimate.quotaFormatted).toContain('Mo')
  })
})

// ─────────────────────────────────────────────────────────────
// checkAndPurgeIfNeeded
// ─────────────────────────────────────────────────────────────

describe('checkAndPurgeIfNeeded', () => {
  const OLD_DATE = new Date(Date.now() - 8 * 86_400_000).toISOString() // 8 jours

  async function insertSyncedEntry(syncedAt: string) {
    await offlineDb.syncQueue.add({
      uuid_client: crypto.randomUUID(),
      farm_id: '00000000-0000-4000-a000-000000000001',
      table_cible: 'harvests',
      payload: {},
      status: 'synced',
      tentatives: 0,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: syncedAt,
    })
  }

  it('usage < 80% → pas de purge, purged = false', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 10_000_000, quota: 50_000_000 }),
      },
    })

    await insertSyncedEntry(OLD_DATE)
    const result = await checkAndPurgeIfNeeded()
    expect(result.purged).toBe(false)
    expect(result.entriesPurged).toBe(0)
  })

  it('usage > 80% avec des archives > 7j → purge, purged = true', async () => {
    // Première estimation : > 80%, après purge : < 80%
    let callCount = 0
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({ usage: 45_000_000, quota: 50_000_000 }) // 90%
          }
          return Promise.resolve({ usage: 30_000_000, quota: 50_000_000 }) // 60%
        }),
      },
    })

    await insertSyncedEntry(OLD_DATE)
    await insertSyncedEntry(OLD_DATE)

    const result = await checkAndPurgeIfNeeded()
    expect(result.purged).toBe(true)
    expect(result.entriesPurged).toBeGreaterThan(0)
  })

  it('usage > 80% sans archives → pas de purge possible, purged = false', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 45_000_000, quota: 50_000_000 }),
      },
    })

    // Ajouter des entrées pending (non purgeable)
    await offlineDb.syncQueue.add({
      uuid_client: crypto.randomUUID(),
      farm_id: '00000000-0000-4000-a000-000000000001',
      table_cible: 'harvests',
      payload: {},
      status: 'pending',
      tentatives: 0,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: null,
    })

    const result = await checkAndPurgeIfNeeded()
    expect(result.purged).toBe(false)
    expect(result.entriesPurged).toBe(0)
  })
})
