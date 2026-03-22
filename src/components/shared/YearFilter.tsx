'use client'

import { useTransition } from 'react'

interface Props {
  years: number[]
  selectedYear: number | null
  onChange: (year: number | null) => void
  allLabel?: string
}

/**
 * Sélecteur d'année réutilisable (boutons style toggle).
 * selectedYear = null → "Tout" (pas de filtre année).
 */
export default function YearFilter({ years, selectedYear, onChange, allLabel = 'Tout' }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Année :</span>
      <button
        onClick={() => onChange(null)}
        className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
        style={{
          backgroundColor: selectedYear === null ? 'var(--color-primary)' : 'transparent',
          color: selectedYear === null ? '#fff' : '#6B7280',
          border: selectedYear === null ? 'none' : '1px solid #D1D5DB',
        }}
      >
        {allLabel}
      </button>
      {years.map(y => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
          style={{
            backgroundColor: selectedYear === y ? 'var(--color-primary)' : 'transparent',
            color: selectedYear === y ? '#fff' : '#6B7280',
            border: selectedYear === y ? 'none' : '1px solid #D1D5DB',
          }}
        >
          {y}
        </button>
      ))}
    </div>
  )
}
