import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'
import { ETAT_PLANTE_LABELS, ETAT_PLANTE_COLORS } from '@/lib/constants/etat-plante'

/**
 * Page dashboard — point d'entrée après connexion.
 * Widgets résumé : Stock + Production.
 */
export default async function DashboardPage() {
  const { farmId, orgSlug } = await getContext()

  const [topStock, productionStats] = await Promise.all([
    fetchTopStock(farmId),
    fetchProductionStats(farmId),
  ])

  return (
    <div className="p-4 md:p-8">
      {/* En-tête */}
      <div className="mb-6 md:mb-8">
        <h1
          className="text-xl md:text-2xl font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#9CA89D' }}>
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Widget Stock */}
        <div
          className="rounded-xl p-5 border"
          style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
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

          {topStock.length === 0 ? (
            <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
              Aucun stock enregistré. Les mouvements de stock sont créés lors des cueillettes, transformations et productions.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topStock.map(row => (
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
                          backgroundColor: ETAT_PLANTE_COLORS[e.etat] + '18',
                          color: ETAT_PLANTE_COLORS[e.etat],
                        }}
                        title={ETAT_PLANTE_LABELS[e.etat]}
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

        {/* Widget Production */}
        <div
          className="rounded-xl p-5 border"
          style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
              <span>📈</span> Production {productionStats.annee}
            </h2>
            <Link
              href={`/${orgSlug}/production-totale`}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              Voir tout &rarr;
            </Link>
          </div>

          {productionStats.nbVarietes === 0 ? (
            <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
              Aucune donnée de production pour {productionStats.annee}.
              Les cumuls sont mis à jour automatiquement lors des cueillettes et transformations.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #EDE8E0' }}>
                <span className="text-sm" style={{ color: '#6B7B6C' }}>Variétés actives</span>
                <span className="text-sm font-semibold" style={{ color: '#2C3E2D' }}>
                  {productionStats.nbVarietes}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #EDE8E0' }}>
                <span className="text-sm" style={{ color: '#6B7B6C' }}>Total cueilli</span>
                <span className="text-sm font-semibold" style={{ color: '#22C55E' }}>
                  {formatWeightShort(productionStats.totalCueilli)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #EDE8E0' }}>
                <span className="text-sm" style={{ color: '#6B7B6C' }}>Total trié</span>
                <span className="text-sm font-semibold" style={{ color: '#6366F1' }}>
                  {formatWeightShort(productionStats.totalTrie)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm" style={{ color: '#6B7B6C' }}>Temps total</span>
                <span className="text-sm font-semibold" style={{ color: '#2C3E2D' }}>
                  {formatTimeShort(productionStats.tempsTotalMin)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ─── */

interface TopStockRow {
  variety_id: string
  nom_vernaculaire: string
  total_g: number
  topEtats: { etat: string; stock_g: number }[]
}

/** Récupère le top 5 des variétés par stock total */
async function fetchTopStock(farmId: string): Promise<TopStockRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('v_stock')
    .select('variety_id, etat_plante, stock_g')
    .eq('farm_id', farmId)

  if (error || !data || data.length === 0) return []

  const map = new Map<string, { total: number; etats: Map<string, number> }>()
  for (const row of data) {
    let entry = map.get(row.variety_id)
    if (!entry) {
      entry = { total: 0, etats: new Map() }
      map.set(row.variety_id, entry)
    }
    const g = Number(row.stock_g)
    entry.total += g
    entry.etats.set(row.etat_plante, (entry.etats.get(row.etat_plante) ?? 0) + g)
  }

  const ids = Array.from(map.keys())
  const { data: varieties } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire')
    .in('id', ids)

  const nameMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))

  const sorted = Array.from(map.entries())
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)

  return sorted.map(([id, v]) => ({
    variety_id: id,
    nom_vernaculaire: nameMap.get(id) ?? 'Inconnue',
    total_g: v.total,
    topEtats: Array.from(v.etats.entries())
      .filter(([, g]) => g > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([etat, stock_g]) => ({ etat, stock_g })),
  }))
}

interface ProductionStats {
  annee: number
  nbVarietes: number
  totalCueilli: number
  totalTrie: number
  tempsTotalMin: number
}

/** Récupère les stats de production pour l'année en cours */
async function fetchProductionStats(farmId: string): Promise<ProductionStats> {
  const supabase = createAdminClient()
  const annee = new Date().getFullYear()

  const { data, error } = await supabase
    .from('production_summary')
    .select('variety_id, total_cueilli_g, total_triee_g, temps_cueillette_min, temps_tronconnage_min, temps_sechage_min, temps_triage_min, temps_production_min')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .is('mois', null)

  if (error || !data || data.length === 0) {
    return { annee, nbVarietes: 0, totalCueilli: 0, totalTrie: 0, tempsTotalMin: 0 }
  }

  let totalCueilli = 0
  let totalTrie = 0
  let tempsTotalMin = 0

  for (const row of data) {
    totalCueilli += Number(row.total_cueilli_g) || 0
    totalTrie += Number(row.total_triee_g) || 0
    tempsTotalMin += (Number(row.temps_cueillette_min) || 0) +
      (Number(row.temps_tronconnage_min) || 0) +
      (Number(row.temps_sechage_min) || 0) +
      (Number(row.temps_triage_min) || 0) +
      (Number(row.temps_production_min) || 0)
  }

  return {
    annee,
    nbVarietes: data.length,
    totalCueilli,
    totalTrie,
    tempsTotalMin,
  }
}

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
