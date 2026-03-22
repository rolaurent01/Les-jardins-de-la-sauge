import Link from 'next/link'
import type { DashboardAvancementData } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import type { PartiePlante } from '@/lib/types'

/** Couleur de la barre d'avancement */
function progressColor(pct: number): string {
  if (pct > 100) return '#3B82F6'  // bleu — dépassement
  if (pct >= 80) return '#22C55E'  // vert
  if (pct >= 40) return '#F59E0B'  // orange
  return '#EF4444'                  // rouge
}

function formatKg(g: number): string {
  return `${(g / 1000).toFixed(1)} kg`
}

interface Props {
  data: DashboardAvancementData
  orgSlug: string
}

export function DashboardAvancementWidget({ data, orgSlug }: Props) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
          <span>🎯</span> Avancement prévisionnel
        </h2>
        <Link
          href={`/${orgSlug}/previsionnel`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Voir tout &rarr;
        </Link>
      </div>

      {data.varietes.length === 0 ? (
        <div className="py-4">
          <p className="text-sm" style={{ color: '#9CA89D' }}>
            Définissez vos objectifs dans le Prévisionnel pour suivre votre avancement.
          </p>
          <Link
            href={`/${orgSlug}/previsionnel`}
            className="text-sm font-medium mt-2 inline-block"
            style={{ color: 'var(--color-primary)' }}
          >
            Configurer le prévisionnel &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Barre globale */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: '#2C3E2D' }}>Avancement global</span>
              <span className="text-sm font-bold" style={{ color: progressColor(data.global_pct) }}>
                {data.global_pct}%
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(data.global_pct, 100)}%`,
                  backgroundColor: progressColor(data.global_pct),
                }}
              />
            </div>
          </div>

          {/* Barres par variété */}
          {data.varietes.map((v, i) => (
            <div key={`${v.nom}-${v.partie_plante ?? i}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium truncate flex-1 mr-2" style={{ color: '#2C3E2D' }}>
                  {v.nom}
                  {v.partie_plante && (
                    <span className="ml-1 text-[10px] font-normal" style={{ color: '#6B7B6C' }}>
                      ({PARTIE_PLANTE_LABELS[v.partie_plante as PartiePlante] ?? v.partie_plante})
                    </span>
                  )}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: '#6B7B6C' }}>
                  {v.pct}% ({formatKg(v.cueilli_g)}/{formatKg(v.prevu_g)})
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(v.pct, 100)}%`,
                    backgroundColor: progressColor(v.pct),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
