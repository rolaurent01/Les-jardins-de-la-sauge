import Link from 'next/link'
import type { ProductionStats } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

function formatWeightShort(g: number): string {
  if (g === 0) return '0 g'
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

function formatTimeShort(minutes: number): string {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

interface Props {
  data: ProductionStats
  orgSlug: string
}

export function DashboardProductionWidget({ data, orgSlug }: Props) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
          <span>📈</span> Production {data.annee}
        </h2>
        <Link
          href={`/${orgSlug}/production-totale`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Voir tout &rarr;
        </Link>
      </div>

      {data.nbVarietes === 0 ? (
        <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
          Aucune donnée de production pour {data.annee}.
          Les cumuls sont mis à jour automatiquement lors des cueillettes et transformations.
        </p>
      ) : (
        <div className="space-y-3">
          <StatRow label="Variétés actives" value={String(data.nbVarietes)} />
          <StatRow label="Total cueilli" value={formatWeightShort(data.totalCueilli)} color="#22C55E" />
          <StatRow label="Total trié" value={formatWeightShort(data.totalTrie)} color="#6366F1" />
          <StatRow label="Temps total" value={formatTimeShort(data.tempsTotalMin)} last />
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-1.5"
      style={last ? undefined : { borderBottom: '1px solid #EDE8E0' }}
    >
      <span className="text-sm" style={{ color: '#6B7B6C' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: color ?? '#2C3E2D' }}>{value}</span>
    </div>
  )
}
