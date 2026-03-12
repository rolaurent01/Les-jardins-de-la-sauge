'use client'

import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { DashboardTempsData } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

const ETAPES = [
  { key: 'cueillette_min' as const, label: 'Cueillette', color: '#22C55E' },
  { key: 'tronconnage_min' as const, label: 'Tronçonnage', color: '#F59E0B' },
  { key: 'sechage_min' as const, label: 'Séchage', color: '#EF4444' },
  { key: 'triage_min' as const, label: 'Triage', color: '#6366F1' },
  { key: 'production_min' as const, label: 'Production', color: '#3B82F6' },
]

function formatTime(minutes: number): string {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

interface Props {
  data: DashboardTempsData
  orgSlug: string
}

export function DashboardTempsWidget({ data, orgSlug }: Props) {
  const chartData = ETAPES
    .map(e => ({ name: e.label, value: data[e.key], color: e.color }))
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
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Donut */}
          <div className="w-[140px] h-[140px] flex-shrink-0 relative">
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

          {/* Légende */}
          <div className="flex-1 space-y-1.5 w-full">
            {ETAPES.map(e => {
              const val = data[e.key]
              if (val === 0) return null
              const pct = data.total_min > 0 ? Math.round((val / data.total_min) * 100) : 0
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
      )}
    </div>
  )
}
