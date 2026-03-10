/**
 * Tests unitaires — sync-service.ts
 * Logique du moteur de synchronisation offline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetDatabase, offlineDb } from './helpers/mock-db'
import {
  addToSyncQueue,
  processSyncQueue,
  purgeOldArchives,
  runAudit,
  getSyncQueueStatus,
} from '@/lib/offline/sync-service'

// --- Constantes internes reproduites pour les tests ---
const MAX_TENTATIVES = 5
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

beforeEach(async () => {
  await resetDatabase()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────
// addToSyncQueue
// ─────────────────────────────────────────────────────────────

describe('addToSyncQueue', () => {
  it('crée une entrée avec status pending, tentatives 0, synced_at null', async () => {
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 500 },
    })

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry).toBeDefined()
    expect(entry!.status).toBe('pending')
    expect(entry!.tentatives).toBe(0)
    expect(entry!.synced_at).toBeNull()
  })

  it('génère un UUID v4 valide', async () => {
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    expect(uuid).toMatch(UUID_REGEX)
  })

  it('stocke farm_id et table_cible correctement', async () => {
    const farmId = '00000000-0000-4000-a000-000000000099'
    const uuid = await addToSyncQueue({
      table_cible: 'soil_works',
      farm_id: farmId,
      payload: { type: 'labour' },
    })

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.farm_id).toBe(farmId)
    expect(entry!.table_cible).toBe('soil_works')
  })

  it('crée un created_at au format ISO valide', async () => {
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 200 },
    })

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    const parsed = new Date(entry!.created_at)
    expect(parsed.toISOString()).toBe(entry!.created_at)
  })
})

// ─────────────────────────────────────────────────────────────
// processSyncQueue
// ─────────────────────────────────────────────────────────────

describe('processSyncQueue', () => {
  // Helper pour mocker fetch
  function mockFetchSuccess(serverId = 'srv-001') {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, uuid_client: 'x', server_id: serverId }),
    }))
  }

  function mockFetchError(status = 500) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ success: false, error: `Erreur ${status}` }),
    }))
  }

  function mockFetchNetworkError() {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
  }

  it('entrée pending → envoi OK → status synced + synced_at renseigné', async () => {
    mockFetchSuccess()
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    const result = await processSyncQueue()
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.status).toBe('synced')
    expect(entry!.synced_at).not.toBeNull()
  })

  it('entrée pending → envoi erreur (500) → tentatives incrémenté, status reste pending', async () => {
    mockFetchError(500)
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    const result = await processSyncQueue()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(1)

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.status).toBe('pending')
    expect(entry!.tentatives).toBe(1)
  })

  it('entrée pending → 5 échecs successifs → status passe à error', async () => {
    mockFetchError(500)
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    // Simuler 5 tentatives successives
    for (let i = 0; i < MAX_TENTATIVES; i++) {
      await processSyncQueue()
    }

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.status).toBe('error')
    expect(entry!.tentatives).toBe(MAX_TENTATIVES)
  })

  it('plusieurs entrées → continue après un échec (pas de break)', async () => {
    // Première entrée → fail, deuxième → success
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ success: false, error: 'Erreur test' }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, uuid_client: 'x', server_id: 'srv-002' }),
      })
    }))

    await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })
    await addToSyncQueue({
      table_cible: 'soil_works',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { type: 'binage' },
    })

    const result = await processSyncQueue()
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('entrée déjà synced → ignorée (pas renvoyée)', async () => {
    mockFetchSuccess()
    await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    // Premier envoi réussi
    await processSyncQueue()

    // Deuxième appel : rien à envoyer
    const result = await processSyncQueue()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('entrée error → ignorée (pas renvoyée automatiquement)', async () => {
    mockFetchError(500)
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    // Forcer le passage en error
    for (let i = 0; i < MAX_TENTATIVES; i++) {
      await processSyncQueue()
    }

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.status).toBe('error')

    // Maintenant le fetch devrait réussir, mais l'entrée ne doit plus être traitée
    mockFetchSuccess()
    const result = await processSyncQueue()
    expect(result.sent).toBe(0)
  })

  it('aucune entrée pending → retourne { sent: 0, failed: 0 }', async () => {
    const result = await processSyncQueue()
    expect(result).toEqual({ sent: 0, failed: 0, errors: [] })
  })

  it('erreur réseau → tentatives incrémenté, message erreur stocké', async () => {
    mockFetchNetworkError()
    const uuid = await addToSyncQueue({
      table_cible: 'harvests',
      farm_id: '00000000-0000-4000-a000-000000000001',
      payload: { poids_g: 100 },
    })

    const result = await processSyncQueue()
    expect(result.failed).toBe(1)
    expect(result.errors[0].error).toBe('Network error')

    const entry = await offlineDb.syncQueue.where('uuid_client').equals(uuid).first()
    expect(entry!.derniere_erreur).toBe('Network error')
  })
})

// ─────────────────────────────────────────────────────────────
// purgeOldArchives
// ─────────────────────────────────────────────────────────────

describe('purgeOldArchives', () => {
  const OLD_DATE = new Date(Date.now() - 8 * 86_400_000).toISOString() // 8 jours
  const RECENT_DATE = new Date(Date.now() - 3 * 86_400_000).toISOString() // 3 jours

  async function insertEntry(overrides: Partial<import('@/lib/offline/db').SyncQueueEntry>) {
    await offlineDb.syncQueue.add({
      uuid_client: crypto.randomUUID(),
      farm_id: '00000000-0000-4000-a000-000000000001',
      table_cible: 'harvests',
      payload: {},
      status: 'synced',
      tentatives: 0,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: OLD_DATE,
      ...overrides,
    })
  }

  it('entrée synced + synced_at > 7 jours → supprimée', async () => {
    await insertEntry({ synced_at: OLD_DATE })

    const purged = await purgeOldArchives()
    expect(purged).toBe(1)

    const remaining = await offlineDb.syncQueue.count()
    expect(remaining).toBe(0)
  })

  it('entrée synced + synced_at < 7 jours → conservée', async () => {
    await insertEntry({ synced_at: RECENT_DATE })

    const purged = await purgeOldArchives()
    expect(purged).toBe(0)

    const remaining = await offlineDb.syncQueue.count()
    expect(remaining).toBe(1)
  })

  it('entrée synced + synced_at null → conservée (cas défensif)', async () => {
    await insertEntry({ synced_at: null })

    const purged = await purgeOldArchives()
    expect(purged).toBe(0)

    const remaining = await offlineDb.syncQueue.count()
    expect(remaining).toBe(1)
  })

  it('entrée pending → JAMAIS supprimée', async () => {
    await insertEntry({ status: 'pending', synced_at: OLD_DATE })

    const purged = await purgeOldArchives()
    expect(purged).toBe(0)
  })

  it('entrée syncing → JAMAIS supprimée', async () => {
    await insertEntry({ status: 'syncing', synced_at: OLD_DATE })

    const purged = await purgeOldArchives()
    expect(purged).toBe(0)
  })

  it('entrée error → JAMAIS supprimée', async () => {
    await insertEntry({ status: 'error', synced_at: OLD_DATE })

    const purged = await purgeOldArchives()
    expect(purged).toBe(0)
  })

  it('retourne le bon nombre d\'entrées purgées', async () => {
    await insertEntry({ synced_at: OLD_DATE })
    await insertEntry({ synced_at: OLD_DATE })
    await insertEntry({ synced_at: RECENT_DATE }) // pas purgée
    await insertEntry({ status: 'pending' }) // pas purgée

    const purged = await purgeOldArchives()
    expect(purged).toBe(2)

    const remaining = await offlineDb.syncQueue.count()
    expect(remaining).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
// runAudit
// ─────────────────────────────────────────────────────────────

describe('runAudit', () => {
  const FARM_ID = '00000000-0000-4000-a000-000000000001'

  async function insertSyncedEntry(uuid: string) {
    await offlineDb.syncQueue.add({
      uuid_client: uuid,
      farm_id: FARM_ID,
      table_cible: 'harvests',
      payload: {},
      status: 'synced',
      tentatives: 1,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
  }

  it('tous les synced sont confirmés → missing = 0', async () => {
    const uuids = ['aaa-1', 'bbb-2'].map(() => crypto.randomUUID())
    for (const uuid of uuids) await insertSyncedEntry(uuid)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        confirmed: uuids,
        missing: [],
        total_checked: uuids.length,
      }),
    }))

    const result = await runAudit(FARM_ID)
    expect(result.confirmed).toBe(2)
    expect(result.missing).toBe(0)
    expect(result.missingUuids).toEqual([])
  })

  it('2 synced sont missing → repassés en pending avec tentatives = 0', async () => {
    const uuid1 = crypto.randomUUID()
    const uuid2 = crypto.randomUUID()
    await insertSyncedEntry(uuid1)
    await insertSyncedEntry(uuid2)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        confirmed: [],
        missing: [uuid1, uuid2],
        total_checked: 2,
      }),
    }))

    const result = await runAudit(FARM_ID)
    expect(result.missing).toBe(2)

    // Vérifier que les entrées sont repassées en pending
    const entry1 = await offlineDb.syncQueue.where('uuid_client').equals(uuid1).first()
    expect(entry1!.status).toBe('pending')
    expect(entry1!.tentatives).toBe(0)
    expect(entry1!.synced_at).toBeNull()
  })

  it('pagination : 250 entrées → 2 appels API (200 + 50)', async () => {
    const uuids: string[] = []
    for (let i = 0; i < 250; i++) {
      const uuid = crypto.randomUUID()
      uuids.push(uuid)
      await insertSyncedEntry(uuid)
    }

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          confirmed: body.uuid_clients,
          missing: [],
          total_checked: body.uuid_clients.length,
        }),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAudit(FARM_ID)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.totalChecked).toBe(250)
    expect(result.confirmed).toBe(250)
  })

  it('erreur API pendant l\'audit → errors incrémenté, pas de crash', async () => {
    await insertSyncedEntry(crypto.randomUUID())

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')))

    const result = await runAudit(FARM_ID)
    expect(result.errors).toBe(1)
    // Le total est 0 car l'appel a échoué
    expect(result.totalChecked).toBe(0)
  })

  it('aucune entrée synced → retourne zéros', async () => {
    const result = await runAudit(FARM_ID)
    expect(result).toEqual({
      totalChecked: 0,
      confirmed: 0,
      missing: 0,
      errors: 0,
      missingUuids: [],
    })
  })
})

// ─────────────────────────────────────────────────────────────
// getSyncQueueStatus
// ─────────────────────────────────────────────────────────────

describe('getSyncQueueStatus', () => {
  it('retourne les compteurs corrects par status', async () => {
    const base = {
      farm_id: '00000000-0000-4000-a000-000000000001',
      table_cible: 'harvests',
      payload: {},
      tentatives: 0,
      derniere_erreur: null,
      created_at: new Date().toISOString(),
      synced_at: null,
    }

    await offlineDb.syncQueue.bulkAdd([
      { ...base, uuid_client: crypto.randomUUID(), status: 'pending' },
      { ...base, uuid_client: crypto.randomUUID(), status: 'pending' },
      { ...base, uuid_client: crypto.randomUUID(), status: 'syncing' },
      { ...base, uuid_client: crypto.randomUUID(), status: 'synced', synced_at: new Date().toISOString() },
      { ...base, uuid_client: crypto.randomUUID(), status: 'synced', synced_at: new Date().toISOString() },
      { ...base, uuid_client: crypto.randomUUID(), status: 'synced', synced_at: new Date().toISOString() },
      { ...base, uuid_client: crypto.randomUUID(), status: 'error', derniere_erreur: 'test' },
    ])

    const status = await getSyncQueueStatus()
    expect(status.pending).toBe(2)
    expect(status.syncing).toBe(1)
    expect(status.synced).toBe(3)
    expect(status.error).toBe(1)
    expect(status.total).toBe(7)
  })
})
