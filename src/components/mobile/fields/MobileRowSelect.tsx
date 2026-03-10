'use client'

import { useMemo } from 'react'
import MobileSelect, { type OptionGroup } from './MobileSelect'
import { useCachedRows } from '@/hooks/useCachedData'

interface MobileRowSelectProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
}

/**
 * Select de rangs groupé par site / parcelle.
 * Utilise les données du cache IndexedDB (sites, parcelles, rangs).
 * Structure : "Site — Parcelle-Code → Rang N"
 */
export default function MobileRowSelect({ value, onChange, error }: MobileRowSelectProps) {
  const { rows, parcels, sites, isLoading } = useCachedRows()

  const groupedOptions: OptionGroup[] = useMemo(() => {
    // Index sites et parcelles par id
    const siteMap = new Map(sites.map((s) => [s.id, s]))
    const parcelMap = new Map(parcels.map((p) => [p.id, p]))

    // Grouper les rangs par parcelle
    const byParcel = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = row.parcel_id
      if (!byParcel.has(key)) byParcel.set(key, [])
      byParcel.get(key)!.push(row)
    }

    const groups: OptionGroup[] = []

    for (const [parcelId, parcelRows] of byParcel) {
      const parcel = parcelMap.get(parcelId)
      if (!parcel) continue
      const site = siteMap.get(parcel.site_id)
      const groupLabel = site
        ? `${site.nom} — ${parcel.code}`
        : parcel.code

      // Trier les rangs par position ou numéro
      const sorted = [...parcelRows].sort(
        (a, b) => (a.position_ordre ?? 0) - (b.position_ordre ?? 0),
      )

      groups.push({
        group: groupLabel,
        options: sorted.map((r) => ({
          value: r.id,
          label: `Rang ${r.numero}`,
        })),
      })
    }

    // Trier les groupes par nom de site puis code parcelle
    groups.sort((a, b) => a.group.localeCompare(b.group))

    return groups
  }, [rows, parcels, sites])

  return (
    <MobileSelect
      label="Rang"
      required
      value={value}
      onChange={onChange}
      groupedOptions={groupedOptions}
      placeholder={isLoading ? 'Chargement…' : 'Sélectionner un rang'}
      error={error}
    />
  )
}
