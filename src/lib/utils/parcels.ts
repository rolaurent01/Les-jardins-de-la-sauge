import type { RowWithParcel } from '@/lib/types'

/** Groupe les rangs par parcelle (site — parcelle (code)) */
export function groupRowsByParcel(rows: RowWithParcel[]): Map<string, { label: string; rows: RowWithParcel[] }> {
  const groups = new Map<string, { label: string; rows: RowWithParcel[] }>()

  for (const row of rows) {
    const parcel = row.parcels as { id?: string; nom?: string; code?: string; sites?: { nom?: string } | null } | null
    const siteName = parcel?.sites?.nom ?? ''
    const parcelName = parcel?.nom ?? ''
    const parcelCode = parcel?.code ?? ''
    const groupKey = `${siteName}__${parcelName}`
    const groupLabel = siteName
      ? `${siteName} — ${parcelName} (${parcelCode})`
      : `${parcelName} (${parcelCode})`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: groupLabel, rows: [] })
    }
    groups.get(groupKey)!.rows.push(row)
  }

  return groups
}
