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
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, errors: [] }

  const pendingEntries = await offlineDb.syncQueue
    .where('status')
    .equals('pending')
    .sortBy('created_at')

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
 * Ne touche JAMAIS aux entrées pending, syncing ou error.
 */
export async function purgeOldArchives(): Promise<number> {
  const cutoffDate = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * MS_PER_DAY).toISOString()

  const oldEntries = await offlineDb.syncQueue
    .where('status')
    .equals('synced')
    .filter((entry) => entry.synced_at !== null && entry.synced_at < cutoffDate)
    .toArray()

  if (oldEntries.length === 0) return 0

  const ids = oldEntries
    .map((e) => e.id)
    .filter((id): id is number => id !== undefined)

  if (ids.length > 0) {
    await offlineDb.syncQueue.bulkDelete(ids)
  }

  return ids.length
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

/** Envoie une entrée au serveur via POST /api/sync */
async function sendToServer(entry: SyncQueueEntry): Promise<ServerSyncResponse> {
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uuid_client: entry.uuid_client,
      table_cible: entry.table_cible,
      farm_id: entry.farm_id,
      payload: entry.payload,
    }),
  })

  return response.json() as Promise<ServerSyncResponse>
}

interface ServerAuditResponse {
  confirmed: string[]
  missing: string[]
  total_checked: number
}

/** Envoie un lot d'UUID au serveur pour vérification */
async function sendAuditBatch(
  uuidClients: string[],
  farmId: string,
): Promise<ServerAuditResponse> {
  const response = await fetch('/api/sync/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid_clients: uuidClients, farm_id: farmId }),
  })

  if (!response.ok) {
    throw new Error(`Audit HTTP ${response.status}`)
  }

  return response.json() as Promise<ServerAuditResponse>
}

/** Gère l'erreur d'une entrée : incrémente tentatives, passe en 'error' si >= MAX */
async function handleSyncError(entry: SyncQueueEntry, errorMessage: string): Promise<void> {
  if (entry.id === undefined) return

  const newTentatives = entry.tentatives + 1
  const newStatus = newTentatives >= MAX_TENTATIVES ? 'error' : 'pending'

  await offlineDb.syncQueue.update(entry.id, {
    status: newStatus,
    tentatives: newTentatives,
    derniere_erreur: errorMessage,
  })
}

/** Pause utilitaire */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
