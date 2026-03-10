import { offlineDb } from './db'

const PURGE_THRESHOLD_PERCENT = 80
const ARCHIVE_RETENTION_DAYS = 7
const MS_PER_DAY = 86_400_000

interface StorageEstimate {
  usageBytes: number
  quotaBytes: number
  usagePercent: number // 0-100
  usageFormatted: string // "12.3 Mo"
  quotaFormatted: string // "50 Mo"
}

interface PurgeResult {
  purged: boolean
  entriesPurged: number
}

/**
 * Retourne l'usage et le quota estimé d'IndexedDB.
 * Utilise navigator.storage.estimate() avec fallback si indisponible.
 */
export async function getStorageEstimate(): Promise<StorageEstimate> {
  const fallbackQuota = 50_000_000 // 50 Mo

  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return {
      usageBytes: 0,
      quotaBytes: fallbackQuota,
      usagePercent: 0,
      usageFormatted: formatBytes(0),
      quotaFormatted: formatBytes(fallbackQuota),
    }
  }

  const estimate = await navigator.storage.estimate()
  const usage = estimate.usage ?? 0
  const quota = estimate.quota ?? fallbackQuota
  const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0

  return {
    usageBytes: usage,
    quotaBytes: quota,
    usagePercent: percent,
    usageFormatted: formatBytes(usage),
    quotaFormatted: formatBytes(quota),
  }
}

/**
 * Vérifie si l'usage dépasse 80% du quota et purge les archives si nécessaire.
 *
 * Règles de purge :
 * - Seules les entrées syncQueue avec status='synced' ET synced_at > 7 jours
 * - En commençant par les plus anciennes
 * - S'arrête dès qu'on passe sous 80% ou qu'il n'y a plus rien à purger
 * - JAMAIS de suppression des entrées pending/syncing/error
 */
export async function checkAndPurgeIfNeeded(): Promise<PurgeResult> {
  const estimate = await getStorageEstimate()

  if (estimate.usagePercent < PURGE_THRESHOLD_PERCENT) {
    return { purged: false, entriesPurged: 0 }
  }

  const cutoffDate = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * MS_PER_DAY).toISOString()

  // Récupérer les entrées purgeable (synced + anciennes), triées par date croissante
  const purgeableEntries = await offlineDb.syncQueue
    .where('status')
    .equals('synced')
    .filter((entry) => entry.synced_at !== null && entry.synced_at < cutoffDate)
    .sortBy('created_at')

  if (purgeableEntries.length === 0) {
    return { purged: false, entriesPurged: 0 }
  }

  // Supprimer par lots de 50 et revérifier l'usage
  const BATCH_SIZE = 50
  let totalPurged = 0

  for (let i = 0; i < purgeableEntries.length; i += BATCH_SIZE) {
    const batch = purgeableEntries.slice(i, i + BATCH_SIZE)
    const ids = batch.map((e) => e.id).filter((id): id is number => id !== undefined)

    if (ids.length > 0) {
      await offlineDb.syncQueue.bulkDelete(ids)
      totalPurged += ids.length
    }

    // Revérifier l'usage après chaque lot
    const currentEstimate = await getStorageEstimate()
    if (currentEstimate.usagePercent < PURGE_THRESHOLD_PERCENT) {
      break
    }
  }

  return { purged: totalPurged > 0, entriesPurged: totalPurged }
}

/** Formate des bytes en chaîne lisible : "12.3 Mo", "456 Ko" */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'

  const units = ['o', 'Ko', 'Mo', 'Go']
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  const value = bytes / Math.pow(k, i)

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
