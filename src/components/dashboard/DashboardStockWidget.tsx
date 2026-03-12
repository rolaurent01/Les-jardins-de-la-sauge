import Link from 'next/link'
import type { TopStockRow } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'
import { ETAT_PLANTE_LABELS, ETAT_PLANTE_COLORS } from '@/lib/constants/etat-plante'

/** Formate un poids en g ou kg */
function formatWeightShort(g: number): string {
  if (g === 0) return '0 g'
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

interface Props {
  data: TopStockRow[]
  orgSlug: string
}

export function DashboardStockWidget({ data, orgSlug }: Props) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
          <span>📦</span> Stock en cours
        </h2>
        <Link
          href={`/${orgSlug}/stock/vue-stock`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Voir tout &rarr;
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
          Aucun stock enregistré. Les mouvements de stock sont créés lors des cueillettes, transformations et productions.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.map(row => (
            <div
              key={row.variety_id}
              className="flex items-center justify-between py-1.5"
              style={{ borderBottom: '1px solid #EDE8E0' }}
            >
              <span className="text-sm font-medium truncate flex-1 mr-3" style={{ color: '#2C3E2D' }}>
                {row.nom_vernaculaire}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {row.topEtats.map(e => (
                  <span
                    key={e.etat}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: (ETAT_PLANTE_COLORS[e.etat] ?? '#9CA89D') + '18',
                      color: ETAT_PLANTE_COLORS[e.etat] ?? '#9CA89D',
                    }}
                    title={ETAT_PLANTE_LABELS[e.etat] ?? e.etat}
                  >
                    {formatWeightShort(e.stock_g)}
                  </span>
                ))}
                <span
                  className="text-xs font-semibold ml-1 min-w-[48px] text-right"
                  style={{ color: '#2C3E2D' }}
                >
                  {formatWeightShort(row.total_g)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
