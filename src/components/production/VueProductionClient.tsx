'use client'

import { useState, useMemo, useTransition } from 'react'
import type { ProductionSummaryRow, ForecastMap } from '@/app/[orgSlug]/(dashboard)/production-totale/actions'
import { fetchProductionSummary, fetchForecastsForProduction } from '@/app/[orgSlug]/(dashboard)/production-totale/actions'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import * as XLSX from 'xlsx'

/* ─── Constantes ─── */

const MOIS_LABELS: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril',
  5: 'Mai', 6: 'Juin', 7: 'Juillet', 8: 'Août',
  9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
}

const CHART_COLORS = {
  cueilli: '#22C55E',
  tronconnee: '#F59E0B',
  sechee: '#3B82F6',
  triee: '#6366F1',
}

const TIME_COLORS = {
  Cueillette: '#22C55E',
  Tronçonnage: '#F59E0B',
  Séchage: '#3B82F6',
  Triage: '#6366F1',
  Production: '#EC4899',
}

/* ─── Helpers ─── */

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatWeight(g: number): string {
  if (g === 0) return '—'
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

function formatTime(minutes: number): string {
  if (minutes === 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

function getProgressColor(pct: number): string {
  if (pct > 100) return '#3B82F6'
  if (pct >= 80) return '#22C55E'
  if (pct >= 40) return '#F59E0B'
  return '#EF4444'
}

/* ─── Props ─── */

type Props = {
  initialData: ProductionSummaryRow[]
  initialForecasts: ForecastMap
  initialYear: number
  availableYears: number[]
}

/* ─── Composant principal ─── */

export default function VueProductionClient({
  initialData,
  initialForecasts,
  initialYear,
  availableYears,
}: Props) {
  const [data, setData] = useState(initialData)
  const [forecasts, setForecasts] = useState(initialForecasts)
  const [year, setYear] = useState(initialYear)
  const [mois, setMois] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [familleFilter, setFamilleFilter] = useState('all')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [expandedVariety, setExpandedVariety] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'temps'>('table')
  const [isPending, startTransition] = useTransition()

  // Charger les données pour une année/mois
  function loadData(newYear: number, newMois: number | null) {
    startTransition(async () => {
      const [newData, newForecasts] = await Promise.all([
        fetchProductionSummary(newYear, newMois),
        fetchForecastsForProduction(newYear),
      ])
      setData(newData)
      setForecasts(newForecasts)
    })
  }

  function handleYearChange(y: number) {
    setYear(y)
    loadData(y, mois)
  }

  function handleMoisChange(m: number | null) {
    setMois(m)
    loadData(year, m)
  }

  // Familles uniques
  const familles = useMemo(() => {
    const set = new Set(data.map(r => r.famille).filter(Boolean) as string[])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [data])

  // Filtrage
  const displayed = useMemo(() => {
    let rows = data

    if (hideEmpty) {
      rows = rows.filter(r =>
        r.total_cueilli_g > 0 || r.total_tronconnee_g > 0 || r.total_sechee_g > 0 ||
        r.total_triee_g > 0 || r.total_utilise_production_g > 0 ||
        r.total_vendu_direct_g > 0 || r.total_achete_g > 0,
      )
    }

    if (search.trim()) {
      const q = normalize(search)
      rows = rows.filter(r =>
        normalize(r.nom_vernaculaire).includes(q) ||
        (r.nom_latin && normalize(r.nom_latin).includes(q)) ||
        (r.famille && normalize(r.famille).includes(q)),
      )
    }

    if (familleFilter !== 'all') {
      rows = rows.filter(r => r.famille === familleFilter)
    }

    return rows
  }, [data, search, familleFilter, hideEmpty])

  // Totaux
  const totals = useMemo(() => {
    const t = {
      total_cueilli_g: 0, total_tronconnee_g: 0, total_sechee_g: 0,
      total_triee_g: 0, total_utilise_production_g: 0, total_vendu_direct_g: 0,
      total_achete_g: 0, temps_total_min: 0,
      temps_cueillette_min: 0, temps_tronconnage_min: 0,
      temps_sechage_min: 0, temps_triage_min: 0, temps_production_min: 0,
    }
    for (const r of displayed) {
      t.total_cueilli_g += r.total_cueilli_g
      t.total_tronconnee_g += r.total_tronconnee_g
      t.total_sechee_g += r.total_sechee_g
      t.total_triee_g += r.total_triee_g
      t.total_utilise_production_g += r.total_utilise_production_g
      t.total_vendu_direct_g += r.total_vendu_direct_g
      t.total_achete_g += r.total_achete_g
      t.temps_total_min += r.temps_total_min
      t.temps_cueillette_min += r.temps_cueillette_min
      t.temps_tronconnage_min += r.temps_tronconnage_min
      t.temps_sechage_min += r.temps_sechage_min
      t.temps_triage_min += r.temps_triage_min
      t.temps_production_min += r.temps_production_min
    }
    return t
  }, [displayed])

  // Total prévisionnel
  const totalPrevu = useMemo(() => {
    let sum = 0
    for (const r of displayed) {
      sum += forecasts[r.variety_id] ?? 0
    }
    return sum
  }, [displayed, forecasts])

  // Données graphique barres empilées (top 20 par cueilli)
  const chartData = useMemo(() => {
    return [...displayed]
      .sort((a, b) => b.total_cueilli_g - a.total_cueilli_g)
      .slice(0, 20)
      .map(r => ({
        nom: r.nom_vernaculaire.length > 15
          ? r.nom_vernaculaire.slice(0, 14) + '…'
          : r.nom_vernaculaire,
        'Cueilli': +(r.total_cueilli_g / 1000).toFixed(2),
        'Tronçonné': +(r.total_tronconnee_g / 1000).toFixed(2),
        'Séché': +(r.total_sechee_g / 1000).toFixed(2),
        'Trié': +(r.total_triee_g / 1000).toFixed(2),
      }))
  }, [displayed])

  // Données camembert temps global
  const timeChartData = useMemo(() => {
    const entries = [
      { name: 'Cueillette', value: totals.temps_cueillette_min },
      { name: 'Tronçonnage', value: totals.temps_tronconnage_min },
      { name: 'Séchage', value: totals.temps_sechage_min },
      { name: 'Triage', value: totals.temps_triage_min },
      { name: 'Production', value: totals.temps_production_min },
    ]
    return entries.filter(e => e.value > 0)
  }, [totals])

  // ── Export ──

  function getExportRows() {
    return displayed.map(r => {
      const prevu = forecasts[r.variety_id]
      const pct = prevu ? Math.round((r.total_cueilli_g / prevu) * 100) : null
      return {
        'Variété': r.nom_vernaculaire,
        'Nom latin': r.nom_latin ?? '',
        'Famille': r.famille ?? '',
        'Cueilli (g)': r.total_cueilli_g,
        'Tronçonné (g)': r.total_tronconnee_g,
        'Séché (g)': r.total_sechee_g,
        'Trié (g)': r.total_triee_g,
        'Produit (g)': r.total_utilise_production_g,
        'Vendu (g)': r.total_vendu_direct_g,
        'Acheté (g)': r.total_achete_g,
        'Temps total (min)': r.temps_total_min,
        'Prévu (g)': prevu ?? '',
        'Avancement (%)': pct ?? '',
      }
    })
  }

  function exportCsv() {
    const rows = getExportRows()
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csvLines = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => {
        const val = r[h as keyof typeof r]
        const str = String(val)
        return str.includes(';') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(';')),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `production_${year}${mois ? `_${String(mois).padStart(2, '0')}` : ''}.csv`)
  }

  function exportXlsx() {
    const rows = getExportRows()
    if (rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Production')
    XLSX.writeFile(wb, `production_${year}${mois ? `_${String(mois).padStart(2, '0')}` : ''}.xlsx`)
  }

  // ── Rendu ──

  const hasData = data.length > 0

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Vue Production totale
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            Cumuls d&apos;activité — {displayed.length} variété{displayed.length !== 1 ? 's' : ''}
            {isPending && ' — Chargement…'}
          </p>
        </div>

        {hasData && (
          <ExportMenu onCsv={exportCsv} onXlsx={exportXlsx} />
        )}
      </div>

      {/* Filtres année / mois */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Année */}
        <div className="flex items-center gap-1">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: y === year ? 'var(--color-primary)' : 'transparent',
                color: y === year ? '#F9F8F6' : '#6B7B6C',
                border: `1px solid ${y === year ? 'var(--color-primary)' : '#D8E0D9'}`,
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Mois */}
        <select
          value={mois ?? ''}
          onChange={e => handleMoisChange(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 text-sm rounded-lg border outline-none"
          style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
        >
          <option value="">Année complète</option>
          {Object.entries(MOIS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Recherche */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher variété, famille…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
            aria-label="Rechercher"
          />
        </div>

        {/* Famille */}
        <select
          value={familleFilter}
          onChange={e => setFamilleFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border outline-none"
          style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
        >
          <option value="all">Toutes les familles</option>
          {familles.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        {/* Masquer les vides */}
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6B7B6C' }}>
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={e => setHideEmpty(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--color-primary)' }}
          />
          Masquer les vides
        </label>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-4">
        <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')}>
          Tableau
        </TabButton>
        <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
          Graphique volumes
        </TabButton>
        <TabButton active={activeTab === 'temps'} onClick={() => setActiveTab('temps')}>
          Temps de travail
        </TabButton>
      </div>

      {!hasData && !isPending ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">📈</div>
          <p className="text-sm">
            Aucune donnée de production pour {year}.
            Les cumuls sont mis à jour automatiquement lors des cueillettes et transformations.
          </p>
        </div>
      ) : activeTab === 'table' ? (
        /* ── Tableau ── */
        displayed.length === 0 ? (
          <EmptyFilters />
        ) : (
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#D8E0D9' }}>
            <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9', position: 'sticky', top: 0, zIndex: 1 }}>
                  <Th>Variété</Th>
                  <Th align="right">Cueilli</Th>
                  <Th align="right">Tronç.</Th>
                  <Th align="right">Séché</Th>
                  <Th align="right">Trié</Th>
                  <Th align="right">Produit</Th>
                  <Th align="right">Vendu</Th>
                  <Th align="right">Acheté</Th>
                  <Th align="right">Temps</Th>
                  <Th align="right">Prévu</Th>
                  <Th>Avancement</Th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((row, i) => {
                  const prevu = forecasts[row.variety_id]
                  const pct = prevu ? (row.total_cueilli_g / prevu) * 100 : null
                  const isExpanded = expandedVariety === row.variety_id

                  return (
                    <VarietyRow
                      key={row.variety_id}
                      row={row}
                      index={i}
                      prevu={prevu}
                      pct={pct}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedVariety(isExpanded ? null : row.variety_id)}
                      year={year}
                    />
                  )
                })}

                {/* Ligne de totaux */}
                <tr style={{ backgroundColor: '#F0EDE6', borderTop: '2px solid #D8E0D9' }}>
                  <td className="px-4 py-3 font-semibold text-sm" style={{ color: '#2C3E2D' }}>
                    TOTAL
                  </td>
                  <TdWeight g={totals.total_cueilli_g} bold />
                  <TdWeight g={totals.total_tronconnee_g} bold />
                  <TdWeight g={totals.total_sechee_g} bold />
                  <TdWeight g={totals.total_triee_g} bold />
                  <TdWeight g={totals.total_utilise_production_g} bold />
                  <TdWeight g={totals.total_vendu_direct_g} bold />
                  <TdWeight g={totals.total_achete_g} bold />
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-sm" style={{ color: '#2C3E2D' }}>
                    {formatTime(totals.temps_total_min)}
                  </td>
                  <TdWeight g={totalPrevu} bold />
                  <td className="px-4 py-3">
                    {totalPrevu > 0 && (
                      <ProgressBar pct={(totals.total_cueilli_g / totalPrevu) * 100} />
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'chart' ? (
        /* ── Graphique barres empilées ── */
        chartData.length === 0 ? (
          <EmptyFilters />
        ) : (
          <div className="rounded-xl border p-4" style={{ borderColor: '#D8E0D9', backgroundColor: '#FAFAF8' }}>
            <p className="text-xs font-medium mb-3" style={{ color: '#9CA89D' }}>
              Top 20 variétés par volume cueilli (kg)
            </p>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="nom"
                  angle={-35}
                  textAnchor="end"
                  tick={{ fontSize: 11, fill: '#6B7B6C' }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7B6C' }}
                  label={{ value: 'kg', position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#9CA89D' } }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D8E0D9' }}
                  formatter={(value) => [`${value} kg`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="Cueilli" stackId="a" fill={CHART_COLORS.cueilli} />
                <Bar dataKey="Tronçonné" stackId="a" fill={CHART_COLORS.tronconnee} />
                <Bar dataKey="Séché" stackId="a" fill={CHART_COLORS.sechee} />
                <Bar dataKey="Trié" stackId="a" fill={CHART_COLORS.triee} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        /* ── Onglet Temps de travail ── */
        timeChartData.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl border"
            style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
          >
            <p className="text-sm">Aucun temps de travail enregistré.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camembert global */}
            <div className="rounded-xl border p-4" style={{ borderColor: '#D8E0D9', backgroundColor: '#FAFAF8' }}>
              <p className="text-xs font-medium mb-3" style={{ color: '#9CA89D' }}>
                Répartition globale du temps — Total : {formatTime(totals.temps_total_min)}
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={timeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {timeChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={TIME_COLORS[entry.name as keyof typeof TIME_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D8E0D9' }}
                    formatter={(value) => [formatTime(Number(value))]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Tableau temps par étape */}
            <div className="rounded-xl border p-4" style={{ borderColor: '#D8E0D9', backgroundColor: '#FAFAF8' }}>
              <p className="text-xs font-medium mb-3" style={{ color: '#9CA89D' }}>
                Détail par étape
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Cueillette', min: totals.temps_cueillette_min, color: TIME_COLORS.Cueillette },
                  { label: 'Tronçonnage', min: totals.temps_tronconnage_min, color: TIME_COLORS.Tronçonnage },
                  { label: 'Séchage', min: totals.temps_sechage_min, color: TIME_COLORS.Séchage },
                  { label: 'Triage', min: totals.temps_triage_min, color: TIME_COLORS.Triage },
                  { label: 'Production', min: totals.temps_production_min, color: TIME_COLORS.Production },
                ].map(item => {
                  const pct = totals.temps_total_min > 0
                    ? (item.min / totals.temps_total_min) * 100
                    : 0
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-sm w-24 flex-shrink-0" style={{ color: '#2C3E2D' }}>
                        {item.label}
                      </span>
                      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="text-sm w-16 text-right flex-shrink-0" style={{ color: '#2C3E2D' }}>
                        {formatTime(item.min)}
                      </span>
                      <span className="text-xs w-10 text-right flex-shrink-0" style={{ color: '#9CA89D' }}>
                        {pct > 0 ? `${Math.round(pct)}%` : ''}
                      </span>
                    </div>
                  )
                })}
                <div
                  className="flex items-center gap-3 pt-2 mt-2"
                  style={{ borderTop: '1px solid #D8E0D9' }}
                >
                  <span className="text-sm w-24 flex-shrink-0 font-semibold" style={{ color: '#2C3E2D' }}>
                    Total
                  </span>
                  <div className="flex-1" />
                  <span className="text-sm w-16 text-right flex-shrink-0 font-semibold" style={{ color: '#2C3E2D' }}>
                    {formatTime(totals.temps_total_min)}
                  </span>
                  <span className="text-xs w-10 text-right flex-shrink-0" style={{ color: '#9CA89D' }}>
                    100%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

/* ─── Sous-composants ─── */

/** Ligne de variété avec expansion pour le détail temps */
function VarietyRow({
  row,
  index,
  prevu,
  pct,
  isExpanded,
  onToggle,
  year,
}: {
  row: ProductionSummaryRow
  index: number
  prevu: number | undefined
  pct: number | null
  isExpanded: boolean
  onToggle: () => void
  year: number
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:brightness-95 transition-all"
        style={{
          backgroundColor: index % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
          borderBottom: '1px solid #EDE8E0',
        }}
      >
        <td className="px-4 py-2.5" style={{ color: '#2C3E2D' }}>
          <div className="font-medium">{row.nom_vernaculaire}</div>
          {row.nom_latin && (
            <div className="text-xs italic" style={{ color: '#9CA89D' }}>{row.nom_latin}</div>
          )}
        </td>
        <TdWeight g={row.total_cueilli_g} />
        <TdWeight g={row.total_tronconnee_g} />
        <TdWeight g={row.total_sechee_g} />
        <TdWeight g={row.total_triee_g} />
        <TdWeight g={row.total_utilise_production_g} />
        <TdWeight g={row.total_vendu_direct_g} />
        <TdWeight g={row.total_achete_g} />
        <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ color: '#2C3E2D' }}>
          {formatTime(row.temps_total_min)}
        </td>
        <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ color: '#2C3E2D' }}>
          {prevu ? formatWeight(prevu) : '—'}
        </td>
        <td className="px-4 py-2.5">
          {pct != null ? <ProgressBar pct={pct} /> : <span style={{ color: '#D8E0D9' }}>—</span>}
        </td>
      </tr>

      {/* Détail temps de travail (expansion) */}
      {isExpanded && (
        <tr style={{ backgroundColor: '#F0EDE6' }}>
          <td colSpan={11} className="px-6 py-4">
            <TimeDetail row={row} year={year} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Détail temps de travail pour une variété */
function TimeDetail({ row, year }: { row: ProductionSummaryRow; year: number }) {
  const entries = [
    { label: 'Cueillette', min: row.temps_cueillette_min, color: TIME_COLORS.Cueillette },
    { label: 'Tronçonnage', min: row.temps_tronconnage_min, color: TIME_COLORS.Tronçonnage },
    { label: 'Séchage', min: row.temps_sechage_min, color: TIME_COLORS.Séchage },
    { label: 'Triage', min: row.temps_triage_min, color: TIME_COLORS.Triage },
    { label: 'Production', min: row.temps_production_min, color: TIME_COLORS.Production },
  ]
  const total = row.temps_total_min
  const chartData = entries.filter(e => e.min > 0).map(e => ({ name: e.label, value: e.min }))

  return (
    <div className="flex items-start gap-8">
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: '#2C3E2D' }}>
          {row.nom_vernaculaire} — {year} — Détail temps
        </p>
        <div className="space-y-1.5">
          {entries.map(e => {
            const pct = total > 0 ? Math.round((e.min / total) * 100) : 0
            return (
              <div key={e.label} className="flex items-center gap-3 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: e.color }}
                />
                <span className="w-24" style={{ color: '#2C3E2D' }}>{e.label}</span>
                <span className="w-16 text-right font-medium" style={{ color: '#2C3E2D' }}>
                  {formatTime(e.min)}
                </span>
                <span className="w-10 text-right text-xs" style={{ color: '#9CA89D' }}>
                  {pct > 0 ? `(${pct}%)` : ''}
                </span>
              </div>
            )
          })}
          <div
            className="flex items-center gap-3 text-sm pt-1.5 mt-1.5"
            style={{ borderTop: '1px solid #D8E0D9' }}
          >
            <span className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="w-24 font-semibold" style={{ color: '#2C3E2D' }}>Total</span>
            <span className="w-16 text-right font-bold" style={{ color: '#2C3E2D' }}>
              {formatTime(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Mini donut */}
      {chartData.length > 0 && (
        <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={TIME_COLORS[entry.name as keyof typeof TIME_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #D8E0D9' }}
                formatter={(value) => [formatTime(Number(value))]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** Barre d'avancement colorée */
function ProgressBar({ pct }: { pct: number }) {
  const color = getProgressColor(pct)
  const display = Math.round(pct)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 rounded-full overflow-hidden min-w-[60px]" style={{ backgroundColor: '#E5E7EB' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium whitespace-nowrap" style={{ color }}>
        {display}%
      </span>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
      style={{ color: '#9CA89D', textAlign: align }}
    >
      {children}
    </th>
  )
}

function TdWeight({ g, bold }: { g: number; bold?: boolean }) {
  return (
    <td
      className={`px-4 py-2.5 text-right whitespace-nowrap ${bold ? 'font-semibold' : ''}`}
      style={{ color: g === 0 ? '#D8E0D9' : '#2C3E2D', fontSize: bold ? '0.875rem' : undefined }}
    >
      {g === 0 ? '—' : formatWeight(g)}
    </td>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#6B7B6C',
        border: active ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
      }}
    >
      {children}
    </button>
  )
}

function EmptyFilters() {
  return (
    <div
      className="text-center py-12 rounded-xl border"
      style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
    >
      <p className="text-sm">Aucun résultat ne correspond aux filtres.</p>
    </div>
  )
}

function ExportMenu({ onCsv, onXlsx }: { onCsv: () => void; onXlsx: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
        style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
      >
        Exporter
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 z-20 rounded-lg shadow-lg border py-1"
            style={{ backgroundColor: '#FAFAF8', borderColor: '#D8E0D9', minWidth: '140px' }}
          >
            <button
              onClick={() => { onCsv(); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              style={{ color: '#2C3E2D' }}
            >
              Export CSV
            </button>
            <button
              onClick={() => { onXlsx(); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              style={{ color: '#2C3E2D' }}
            >
              Export XLSX
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Utilitaires ─── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
