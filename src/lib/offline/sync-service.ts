import { offlineDb, type SyncQueueEntry } from './db'
import { generateUUID } from '../utils/uuid'

// --- Constantes ---

const MAX_TENTATIVES = 5
const ARCHIVE_RETENTION_DAYS = 7
const MS_PER_DAY = 86_400_000
const AUDIT_BATCH_SIZE = 200
const AUDIT_BATCH_DELAY_MS = 100

// --- Interfaces publiques ---

export interface SyncResult {
  sent: number
  failed: number
  errors: Array<{ uuid_client: string; error: string }>
}

export interface AuditResult {
  totalChecked: number
  confirmed: number
  missing: number
  errors: number
  missingUuids: string[]
}

export interface SyncQueueStatus {
  pending: number
  syncing: number
  synced: number
  error: number
  total: number
}

// --- Ajouter une saisie à la file ---

/**
 * Ajoute une saisie dans la file d'attente IndexedDB avec status 'pending'.
 * Retourne immédiatement le uuid_client généré (pas d'attente réseau).
 */
export async function addToSyncQueue(params: {
  table_cible: string
  farm_id: string
  payload: Record<string, unknown>
}): Promise<string> {
  const uuidClient = generateUUID()

  const entry: SyncQueueEntry = {
    uuid_client: uuidClient,
    farm_id: params.farm_id,
    table_cible: params.table_cible,
    payload: params.payload,
    status: 'pending',
    tentatives: 0,
    derniere_erreur: null,
    created_at: new Date().toISOString(),
    synced_at: null,
  }

  await offlineDb.syncQueue.add(entry)
  return uuidClient
}

// --- Envoi des saisies pending ---

/**
 * Traite toutes les saisies 'pending' une par une (FIFO).
 * Continue même si une entrée échoue.
 * Fusionne les seedlings_update pending sur le même server_id avant envoi.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, errors: [] }

  let pendingEntries = await offlineDb.syncQueue
    .where('status')
    .equals('pending')
    .sortBy('created_at')

  // Fusionner les seedlings_update multiples sur le même server_id
  pendingEntries = await mergeSeedlingUpdates(pendingEntries)

  for (const entry of pendingEntries) {
    if (entry.id === undefined) continue

    // Passer en 'syncing'
    await offlineDb.syncQueue.update(entry.id, { status: 'syncing' })

    try {
      const response = await sendToServer(entry)

      if (response.success) {
        await offlineDb.syncQueue.update(entry.id, {
          status: 'synced',
          synced_at: new Date().toISOString(),
          derniere_erreur: null,
          payload: { ...entry.payload, server_id: response.server_id },
        })
        result.sent++
      } else {
        await handleSyncError(entry, response.error ?? 'Erreur serveur inconnue')
        result.failed++
        result.errors.push({
          uuid_client: entry.uuid_client,
          error: response.error ?? 'Erreur serveur inconnue',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur réseau'
      await handleSyncError(entry, errorMessage)
      result.failed++
      result.errors.push({ uuid_client: entry.uuid_client, error: errorMessage })
    }
  }

  return result
}

// --- Purge des archives ---

/**
 * Supprime les entrées 'synced' dont synced_at dépasse 7 jours.
 * Réconcilie aussi les entrées 'error' : vérifie côté serveur si elles
 * ont été synchronisées, et les marque 'synced' ou les supprime.
 */
export async function purgeOldArchives(): Promise<number> {
  // 1. Purge classique des vieilles archives synced
  const cutoffDate = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * MS_PER_DAY).toISOString()

  const oldEntries = await offlineDb.syncQueue
    .where('status')
    .equals('synced')
    .filter((entry) => entry.synced_at !== null && entry.synced_at < cutoffDate)
    .toArray()

  let purgedCount = 0

  if (oldEntries.length > 0) {
    const ids = oldEntries
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined)

    if (ids.length > 0) {
      await offlineDb.syncQueue.bulkDelete(ids)
      purgedCount = ids.length
    }
  }

  // 2. Réconciliation des entrées en erreur (erreurs fantômes)
  const reconciledCount = await reconcileErrorEntries()

  return purgedCount + reconciledCount
}

/**
 * Vérifie les entrées 'error' côté serveur par lot.
 * Celles confirmées présentes sont marquées 'synced' (erreurs fantômes).
 * Celles absentes restent en 'error' (vraies erreurs).
 */
async function reconcileErrorEntries(): Promise<number> {
  const errorEntries = await offlineDb.syncQueue
    .where('status')
    .equals('error')
    .toArray()

  if (errorEntries.length === 0) return 0

  // Grouper par farm_id pour l'audit
  const byFarm = new Map<string, SyncQueueEntry[]>()
  for (const entry of errorEntries) {
    const group = byFarm.get(entry.farm_id) ?? []
    group.push(entry)
    byFarm.set(entry.farm_id, group)
  }

  let reconciledCount = 0

  for (const [farmId, entries] of byFarm) {
    const uuids = entries.map((e) => e.uuid_client)

    try {
      const response = await sendAuditBatch(uuids, farmId)
      const confirmedSet = new Set(response.confirmed)

      for (const entry of entries) {
        if (entry.id !== undefined && confirmedSet.has(entry.uuid_client)) {
          // Erreur fantôme → marquer comme synced
          await offlineDb.syncQueue.update(entry.id, {
            status: 'synced',
            synced_at: new Date().toISOString(),
            derniere_erreur: null,
          })
          reconciledCount++
        }
      }
    } catch {
      // Erreur réseau — on réessaiera au prochain cycle
    }
  }

  return reconciledCount
}

// --- Audit batch ---

/**
 * Vérifie que toutes les saisies 'synced' sont bien présentes sur le serveur.
 * Envoie les uuid_client par lots de 200 (pagination).
 * Repasse les 'missing' en 'pending' pour renvoi automatique.
 */
export async function runAudit(farmId: string): Promise<AuditResult> {
  const result: AuditResult = {
    totalChecked: 0,
    confirmed: 0,
    missing: 0,
    errors: 0,
    missingUuids: [],
  }

  const syncedEntries = await offlineDb.syncQueue
    .where('status')
    .equals('synced')
    .toArray()

  if (syncedEntries.length === 0) return result

  const allUuids = syncedEntries.map((e) => e.uuid_client)

  // Traiter par lots de 200
  for (let i = 0; i < allUuids.length; i += AUDIT_BATCH_SIZE) {
    const batch = allUuids.slice(i, i + AUDIT_BATCH_SIZE)

    try {
      const response = await sendAuditBatch(batch, farmId)
      result.totalChecked += response.total_checked
      result.confirmed += response.confirmed.length
      result.missing += response.missing.length
      result.missingUuids.push(...response.missing)
    } catch {
      // Erreur réseau sur ce lot — compter comme erreur d'audit
      result.errors++
    }

    // Délai entre les lots pour ne pas surcharger le serveur
    if (i + AUDIT_BATCH_SIZE < allUuids.length) {
      await delay(AUDIT_BATCH_DELAY_MS)
    }
  }

  // Repasser les entrées manquantes en 'pending' pour renvoi
  for (const missingUuid of result.missingUuids) {
    const entry = syncedEntries.find((e) => e.uuid_client === missingUuid)
    if (entry?.id !== undefined) {
      await offlineDb.syncQueue.update(entry.id, {
        status: 'pending',
        tentatives: 0,
        synced_at: null,
      })
    }
  }

  return result
}

// --- Compteurs et état ---

/**
 * Retourne l'état actuel de la file de sync (toutes fermes confondues).
 */
export async function getSyncQueueStatus(): Promise<SyncQueueStatus> {
  const allEntries = await offlineDb.syncQueue.toArray()

  const status: SyncQueueStatus = {
    pending: 0,
    syncing: 0,
    synced: 0,
    error: 0,
    total: allEntries.length,
  }

  for (const entry of allEntries) {
    if (entry.status in status) {
      status[entry.status as keyof Omit<SyncQueueStatus, 'total'>]++
    }
  }

  return status
}

// --- Fonctions internes ---

interface ServerSyncResponse {
  success: boolean
  uuid_client: string
  server_id?: string
  error?: string
}

/** Envoie une entrée au serveur via POST /api/sync (timeout 30s pour cold start Vercel) */
async function sendToServer(entry: SyncQueueEntry): Promise<ServerSyncResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  const response = await fetch('/api/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      uuid_client: entry.uuid_client,
      table_cible: entry.table_cible,
      farm_id: entry.farm_id,
      payload: entry.payload,
    }),
  })

  clearTimeout(timeoutId)
  return response.json() as Promise<ServerSyncResponse>
}

interface ServerAuditResponse {
  confirmed: string[]
  missing: string[]
  total_checked: number
}

/** Envoie un lot d'UUID au serveur pour vérification (timeout 10s) */
async function sendAuditBatch(
  uuidClients: string[],
  farmId: string,
): Promise<ServerAuditResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  const response = await fetch('/api/sync/audit', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({ uuid_clients: uuidClients, farm_id: farmId }),
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    throw new Error(`Audit HTTP ${response.status}`)
  }

  return response.json() as Promise<ServerAuditResponse>
}

/**
 * Gère l'erreur d'une entrée : incrémente tentatives, passe en 'error' si >= MAX.
 * Avant de marquer 'error', vérifie côté serveur si le uuid_client existe déjà
 * (réconciliation : le serveur a pu committer avant le timeout client).
 */
async function handleSyncError(entry: SyncQueueEntry, errorMessage: string): Promise<void> {
  if (entry.id === undefined) return

  const newTentatives = entry.tentatives + 1

  // Avant de marquer définitivement en erreur, vérifier si le serveur a déjà la donnée
  if (newTentatives >= MAX_TENTATIVES) {
    const existsOnServer = await checkExistsOnServer(entry.uuid_client, entry.farm_id)
    if (existsOnServer) {
      // Erreur fantôme : la donnée est bien sur le serveur
      await offlineDb.syncQueue.update(entry.id, {
        status: 'synced',
        synced_at: new Date().toISOString(),
        derniere_erreur: null,
        tentatives: newTentatives,
      })
      return
    }
  }

  const newStatus = newTentatives >= MAX_TENTATIVES ? 'error' : 'pending'

  await offlineDb.syncQueue.update(entry.id, {
    status: newStatus,
    tentatives: newTentatives,
    derniere_erreur: errorMessage,
  })
}

/**
 * Vérifie côté serveur si un uuid_client existe déjà (via l'API audit).
 * Utilisé pour la réconciliation avant de marquer une entrée en 'error'.
 * En cas d'échec réseau, retourne false (on ne peut pas confirmer).
 */
async function checkExistsOnServer(uuidClient: string, farmId: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch('/api/sync/audit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ uuid_clients: [uuidClient], farm_id: farmId }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) return false

    const data = (await response.json()) as { confirmed: string[]; missing: string[] }
    return data.confirmed.includes(uuidClient)
  } catch {
    // Erreur réseau — on ne peut pas confirmer, on laisse en erreur
    return false
  }
}

/**
 * Fusionne les entrées seedlings_update pending qui ciblent le même server_id.
 * Le payload le plus récent écrase les champs du plus ancien (last write wins).
 * Les entrées fusionnées sont supprimées de IndexedDB, seule la dernière reste.
 */
async function mergeSeedlingUpdates(entries: SyncQueueEntry[]): Promise<SyncQueueEntry[]> {
  // Grouper les seedlings_update par server_id
  const updatesByServerId = new Map<string, SyncQueueEntry[]>()
  const otherEntries: SyncQueueEntry[] = []

  for (const entry of entries) {
    if (entry.table_cible === 'seedlings_update' && entry.payload.server_id) {
      const key = entry.payload.server_id as string
      const group = updatesByServerId.get(key) ?? []
      group.push(entry)
      updatesByServerId.set(key, group)
    } else {
      otherEntries.push(entry)
    }
  }

  const mergedUpdates: SyncQueueEntry[] = []

  for (const [, group] of updatesByServerId) {
    if (group.length === 1) {
      mergedUpdates.push(group[0])
      continue
    }

    // Fusionner les payloads (FIFO : le dernier écrase)
    const mergedPayload: Record<string, unknown> = {}
    for (const entry of group) {
      for (const [k, v] of Object.entries(entry.payload)) {
        if (v !== undefined && v !== null) {
          mergedPayload[k] = v
        }
      }
    }

    // Garder la dernière entrée, mettre à jour son payload
    const keeper = group[group.length - 1]
    keeper.payload = mergedPayload

    if (keeper.id !== undefined) {
      await offlineDb.syncQueue.update(keeper.id, { payload: mergedPayload })
    }

    // Supprimer les entrées antérieures
    const idsToDelete = group
      .slice(0, -1)
      .map((e) => e.id)
      .filter((id): id is number => id !== undefined)

    if (idsToDelete.length > 0) {
      await offlineDb.syncQueue.bulkDelete(idsToDelete)
    }

    mergedUpdates.push(keeper)
  }

  // Reconstituer la liste triée par created_at (maintenir FIFO global)
  return [...otherEntries, ...mergedUpdates].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  )
}

/** Pause utilitaire */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
