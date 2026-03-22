'use client'

import type { DashboardSeedCostRow } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

type Props = {
  data: DashboardSeedCostRow[]
  orgSlug: string
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  if (g < 0.01) return '< 0.01 g'
  return `${g} g`
}

export function DashboardSeedCostWidget({ data, orgSlug }: Props) {
  const hasData = data.length > 0

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E8E4DE',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* En-tete */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold" style={{ color: '#2C3E2D' }}>
          &#x1F331; Graines
        </h2>
        <a
          href={`/${orgSlug}/stock/graines`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Voir tout &rarr;
        </a>
      </div>

      {!hasData ? (
        <p className="text-sm" style={{ color: '#9CA89D' }}>
          Aucune donnee de consommation de graines disponible.
          Effectuez un inventaire de vos sachets pour voir les stats.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Legende */}
          <div
            className="flex items-center text-xs font-medium px-2 py-1"
            style={{ color: '#9CA89D' }}
          >
            <span className="flex-1">Variete</span>
            <span className="w-20 text-right">Graines</span>
            <span className="w-16 text-right">Plants</span>
            <span className="w-20 text-right">g/plant</span>
          </div>

          {data.map(row => (
            <div
              key={row.variety_id}
              className="flex items-center text-sm rounded-lg px-2 py-2"
              style={{ backgroundColor: '#FAF5E9' }}
            >
              <span className="flex-1 font-medium truncate" style={{ color: '#2C3E2D' }}>
                {row.nom_vernaculaire}
              </span>
              <span className="w-20 text-right" style={{ color: '#6B7B6C' }}>
                {formatWeight(row.poids_total_g)}
              </span>
              <span className="w-16 text-right" style={{ color: '#6B7B6C' }}>
                {row.nb_plants_total || '—'}
              </span>
              <span
                className="w-20 text-right font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                {row.poids_par_plant_g !== null ? formatWeight(row.poids_par_plant_g) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
