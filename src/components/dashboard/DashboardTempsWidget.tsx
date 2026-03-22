'use client'

import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { DashboardTempsData } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

type TempsKey = keyof DashboardTempsData & `${string}_min`

interface Etape {
  key: TempsKey
  label: string
  color: string
}

const CULTURE: Etape[] = [
  { key: 'semis_min', label: 'Semis', color: '#65A30D' },
  { key: 'repiquage_min', label: 'Repiquage', color: '#84CC16' },
  { key: 'plantation_min', label: 'Plantation', color: '#A3E635' },
  { key: 'travail_sol_min', label: 'Travail de sol', color: '#CA8A04' },
  { key: 'suivi_rang_min', label: 'Suivi de rang', color: '#D97706' },
  { key: 'arrachage_min', label: 'Arrachage', color: '#92400E' },
  { key: 'occultation_min', label: 'Occultation', color: '#78716C' },
]

const TRANSFORMATION: Etape[] = [
  { key: 'cueillette_min', label: 'Cueillette', color: '#22C55E' },
  { key: 'tronconnage_min', label: 'Tronçonnage', color: '#F59E0B' },
  { key: 'sechage_min', label: 'Séchage', color: '#EF4444' },
  { key: 'triage_min', label: 'Triage', color: '#6366F1' },
  { key: 'production_min', label: 'Production', color: '#3B82F6' },
]

const ALL_ETAPES = [...CULTURE, ...TRANSFORMATION]

function formatTime(minutes: number): string {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

function LegendGroup({ title, etapes, data, totalMin }: {
  title: string
  etapes: Etape[]
  data: DashboardTempsData
  totalMin: number
}) {
  const hasData = etapes.some(e => (data[e.key] as number) > 0)
  if (!hasData) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA89D' }}>
        {title}
      </p>
      <div className="space-y-1">
        {etapes.map(e => {
          const val = data[e.key] as number
          if (val === 0) return null
          const pct = totalMin > 0 ? Math.round((val / totalMin) * 100) : 0
          return (
            <div key={e.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: e.color }}
                />
                <span className="text-xs" style={{ color: '#6B7B6C' }}>{e.label}</span>
              </div>
              <span className="text-xs font-medium" style={{ color: '#2C3E2D' }}>
                {formatTime(val)} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  data: DashboardTempsData
  orgSlug: string
}

export function DashboardTempsWidget({ data, orgSlug }: Props) {
  const chartData = ALL_ETAPES
    .map(e => ({ name: e.label, value: data[e.key] as number, color: e.color }))
    .filter(d => d.value > 0)

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
          <span>⏱️</span> Temps de travail
        </h2>
        <Link
          href={`/${orgSlug}/production-totale`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Voir le détail &rarr;
        </Link>
      </div>

      {data.total_min === 0 ? (
        <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
          Aucun temps de travail enregistré cette saison.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Donut */}
          <div className="w-[140px] h-[140px] flex-shrink-0 relative self-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatTime(Number(value ?? 0))}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Total au centre */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs" style={{ color: '#9CA89D' }}>Total</span>
              <span className="text-sm font-bold" style={{ color: '#2C3E2D' }}>
                {formatTime(data.total_min)}
              </span>
            </div>
          </div>

          {/* Légende avec 2 groupes */}
          <div className="flex-1 space-y-3 w-full">
            <LegendGroup title="Culture" etapes={CULTURE} data={data} totalMin={data.total_min} />
            <LegendGroup title="Transformation" etapes={TRANSFORMATION} data={data} totalMin={data.total_min} />
          </div>
        </div>
      )}
    </div>
  )
}
