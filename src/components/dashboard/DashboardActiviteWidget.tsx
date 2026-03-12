import type { DashboardActiviteItem } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

const TYPE_EMOJI: Record<string, string> = {
  'Cueillette': '🌿',
  'Tronçonnage entrée': '🔪',
  'Tronçonnage sortie': '🔪',
  'Séchage entrée': '☀️',
  'Séchage sortie': '☀️',
  'Triage entrée': '🧹',
  'Triage sortie': '🧹',
  'Production': '🧪',
}

function formatWeightShort(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

/** Regroupe par jour et formate la date */
function groupByDay(items: DashboardActiviteItem[]): { label: string; date: string; items: DashboardActiviteItem[] }[] {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const groups = new Map<string, DashboardActiviteItem[]>()
  for (const item of items) {
    const list = groups.get(item.date) ?? []
    list.push(item)
    groups.set(item.date, list)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      let label = formatDateFr(date)
      if (date === today) label = "Aujourd'hui"
      else if (date === yesterday) label = 'Hier'
      return { label, date, items }
    })
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  data: DashboardActiviteItem[]
}

export function DashboardActiviteWidget({ data }: Props) {
  return (
    <div
      className="rounded-2xl p-5 border md:col-span-2"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
          <span>🕐</span> Activité récente
        </h2>
      </div>

      {data.length === 0 ? (
        <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
          Aucune activité récente. Les opérations saisies apparaîtront ici.
        </p>
      ) : (
        <div className="space-y-4">
          {groupByDay(data).map(group => (
            <div key={group.date}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#9CA89D' }}>
                {group.label}
              </p>
              <div className="space-y-1.5 border-l-2 pl-3 ml-1" style={{ borderColor: '#E8E4DE' }}>
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm">{TYPE_EMOJI[item.type] ?? '📋'}</span>
                    <span className="text-sm" style={{ color: '#2C3E2D' }}>
                      <span className="font-medium">{item.type}</span>
                      {' — '}
                      <span>{item.variete}</span>
                    </span>
                    {item.poids_g != null && item.poids_g > 0 && (
                      <span className="text-xs font-medium ml-auto flex-shrink-0" style={{ color: '#6B7B6C' }}>
                        {formatWeightShort(item.poids_g)}
                      </span>
                    )}
                    {item.nb_unites != null && (
                      <span className="text-xs font-medium ml-auto flex-shrink-0" style={{ color: '#6B7B6C' }}>
                        {item.nb_unites} unités
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
