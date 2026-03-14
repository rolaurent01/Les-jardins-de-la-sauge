'use client'

import { useState, useMemo } from 'react'
import type { StockEntry, StockAlert } from '@/app/[orgSlug]/(dashboard)/stock/vue-stock/actions'
import { ETATS_PLANTE, ETAT_PLANTE_LABELS, ETAT_PLANTE_COLORS } from '@/lib/constants/etat-plante'
import type { EtatPlanteValue } from '@/lib/constants/etat-plante'
import { PARTIE_COLORS } from '@/lib/utils/colors'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import type { PartiePlante } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import * as XLSX from 'xlsx'

/* ─── Types internes ─── */

interface StockRow {
  variety_id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  partie_plante: string
  frais: number
  tronconnee: number
  sechee: number
  tronconnee_sechee: number
  sechee_triee: number
  tronconnee_sechee_triee: number
  total: number
}

/* ─── Helpers ─── */

/** Normalise pour recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Formate un poids en g ou kg pour affichage */
function formatWeight(g: number): string {
  if (g === 0) return ''
  if (g < 0) return `${g} g`
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

/** Pivot des lignes v_stock → lignes tableau (variété × partie) */
function pivotStock(entries: StockEntry[]): StockRow[] {
  const map = new Map<string, StockRow>()

  for (const e of entries) {
    const key = `${e.variety_id}:${e.partie_plante}`
    let row = map.get(key)
    if (!row) {
      row = {
        variety_id: e.variety_id,
        nom_vernaculaire: e.nom_vernaculaire,
        nom_latin: e.nom_latin,
        famille: e.famille,
        partie_plante: e.partie_plante,
        frais: 0,
        tronconnee: 0,
        sechee: 0,
        tronconnee_sechee: 0,
        sechee_triee: 0,
        tronconnee_sechee_triee: 0,
        total: 0,
      }
      map.set(key, row)
    }
    const etat = e.etat_plante as EtatPlanteValue
    if (etat in row) {
      ;(row as unknown as Record<string, number>)[etat] += e.stock_g
    }
    row.total += e.stock_g
  }

  // Tri : famille → nom_vernaculaire → partie_plante
  const rows = Array.from(map.values())
  rows.sort((a, b) => {
    const fa = a.famille ?? ''
    const fb = b.famille ?? ''
    if (fa !== fb) return fa.localeCompare(fb, 'fr')
    if (a.nom_vernaculaire !== b.nom_vernaculaire)
      return a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr')
    return a.partie_plante.localeCompare(b.partie_plante, 'fr')
  })

  return rows
}

/* ─── Composant principal ─── */

type Props = {
  entries: StockEntry[]
  alerts: StockAlert[]
}

export default function VueStockClient({ entries, alerts }: Props) {
  const [search, setSearch] = useState('')
  const [familleFilter, setFamilleFilter] = useState<string>('all')
  const [partieFilter, setPartieFilter] = useState<string>('all')
  const [etatFilters, setEtatFilters] = useState<Set<string>>(new Set())
  const [hideZero, setHideZero] = useState(true)
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table')
  const [varietyFilter, setVarietyFilter] = useState<string | null>(null)

  const allRows = useMemo(() => pivotStock(entries), [entries])

  // Extraire les familles uniques
  const familles = useMemo(() => {
    const set = new Set(allRows.map(r => r.famille).filter(Boolean) as string[])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allRows])

  // Extraire les parties uniques
  const parties = useMemo(() => {
    const set = new Set(allRows.map(r => r.partie_plante))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allRows])

  // Filtrage
  const displayed = useMemo(() => {
    let rows = allRows

    // Filtre variété (clic alerte)
    if (varietyFilter) {
      rows = rows.filter(r => r.variety_id === varietyFilter)
    }

    // Masquer les lignes à zéro
    if (hideZero) {
      rows = rows.filter(r => r.total > 0)
    }

    // Recherche textuelle
    if (search.trim()) {
      const q = normalize(search)
      rows = rows.filter(r =>
        normalize(r.nom_vernaculaire).includes(q) ||
        (r.nom_latin && normalize(r.nom_latin).includes(q)) ||
        (r.famille && normalize(r.famille).includes(q))
      )
    }

    // Filtre par famille
    if (familleFilter !== 'all') {
      rows = rows.filter(r => r.famille === familleFilter)
    }

    // Filtre par partie
    if (partieFilter !== 'all') {
      rows = rows.filter(r => r.partie_plante === partieFilter)
    }

    // Filtre par états (masquer les colonnes — mais on filtre les lignes qui n'ont rien dans ces états)
    if (etatFilters.size > 0) {
      rows = rows.filter(r =>
        Array.from(etatFilters).some(e => (r as unknown as Record<string, number>)[e] > 0)
      )
    }

    return rows
  }, [allRows, search, familleFilter, partieFilter, etatFilters, hideZero, varietyFilter])

  // Totaux par colonne
  const totals = useMemo(() => {
    const t = { frais: 0, tronconnee: 0, sechee: 0, tronconnee_sechee: 0, sechee_triee: 0, tronconnee_sechee_triee: 0, total: 0 }
    for (const r of displayed) {
      for (const e of ETATS_PLANTE) t[e] += r[e]
      t.total += r.total
    }
    return t
  }, [displayed])

  // Données graphique (top 20 par stock total)
  const chartData = useMemo(() => {
    // Agréger par variété
    interface ChartEntry { nom: string; frais: number; tronconnee: number; sechee: number; tronconnee_sechee: number; sechee_triee: number; tronconnee_sechee_triee: number; total: number }
    const map = new Map<string, ChartEntry>()
    for (const r of displayed) {
      let entry = map.get(r.variety_id)
      if (!entry) {
        entry = { nom: r.nom_vernaculaire, frais: 0, tronconnee: 0, sechee: 0, tronconnee_sechee: 0, sechee_triee: 0, tronconnee_sechee_triee: 0, total: 0 }
        map.set(r.variety_id, entry)
      }
      for (const e of ETATS_PLANTE) entry[e] += r[e]
      entry.total += r.total
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(e => ({
        nom: e.nom.length > 15 ? e.nom.slice(0, 14) + '…' : e.nom,
        // Convertir en kg pour le graphique
        Frais: +(e.frais / 1000).toFixed(2),
        'Tronçonnée': +(e.tronconnee / 1000).toFixed(2),
        'Séchée': +(e.sechee / 1000).toFixed(2),
        'Tronç. séchée': +(e.tronconnee_sechee / 1000).toFixed(2),
        'Séch. triée': +(e.sechee_triee / 1000).toFixed(2),
        'Tronç. séch. triée': +(e.tronconnee_sechee_triee / 1000).toFixed(2),
      }))
  }, [displayed])

  // ── Fonctions d'état ──

  function toggleEtatFilter(etat: string) {
    setEtatFilters(prev => {
      const next = new Set(prev)
      if (next.has(etat)) next.delete(etat)
      else next.add(etat)
      return next
    })
  }

  function handleAlertClick(varietyId: string) {
    setVarietyFilter(prev => (prev === varietyId ? null : varietyId))
  }

  // ── Export ──

  function getExportRows() {
    return displayed.map(r => ({
      'Variété': r.nom_vernaculaire,
      'Nom latin': r.nom_latin ?? '',
      'Famille': r.famille ?? '',
      'Partie': PARTIE_PLANTE_LABELS[r.partie_plante as PartiePlante] ?? r.partie_plante,
      'Frais (g)': r.frais,
      'Tronçonnée (g)': r.tronconnee,
      'Séchée (g)': r.sechee,
      'Tronç. séchée (g)': r.tronconnee_sechee,
      'Séch. triée (g)': r.sechee_triee,
      'Tronç. séch. triée (g)': r.tronconnee_sechee_triee,
      'Total (g)': r.total,
    }))
  }

  function exportCsv() {
    const rows = getExportRows()
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csvLines = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => {
        const val = r[h as keyof typeof r]
        // Échapper les guillemets et encapsuler si contient ; ou "
        const str = String(val)
        return str.includes(';') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(';')),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `stock_${todayStr()}.csv`)
  }

  function exportXlsx() {
    const rows = getExportRows()
    if (rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock')
    XLSX.writeFile(wb, `stock_${todayStr()}.xlsx`)
  }

  // ── Rendu ──

  const hasData = entries.length > 0

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Vue Stock
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            Stock temps réel — {displayed.length} ligne{displayed.length !== 1 ? 's' : ''}
          </p>
        </div>

        {hasData && (
          <div className="flex items-center gap-2">
            <ExportMenu onCsv={exportCsv} onXlsx={exportXlsx} />
          </div>
        )}
      </div>

      {/* Alertes stock bas */}
      {alerts.length > 0 && (
        <div
          className="mb-4 px-4 py-3 rounded-lg flex items-center gap-2 flex-wrap"
          style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}
        >
          <span className="font-medium text-sm" style={{ color: '#92400E' }}>
            Stock bas :
          </span>
          {alerts.map(a => (
            <button
              key={a.variety_id}
              onClick={() => handleAlertClick(a.variety_id)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: varietyFilter === a.variety_id ? '#92400E' : '#FDE68A',
                color: varietyFilter === a.variety_id ? '#FEF3C7' : '#92400E',
              }}
            >
              {a.nom_vernaculaire} ({formatWeight(a.stock_total_g) || '0 g'}, seuil {formatWeight(a.seuil_g)})
            </button>
          ))}
          {varietyFilter && (
            <button
              onClick={() => setVarietyFilter(null)}
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#FDE68A', color: '#92400E' }}
            >
              Tout afficher
            </button>
          )}
        </div>
      )}

      {!hasData ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">📦</div>
          <p className="text-sm">
            Aucun stock enregistré. Les mouvements de stock sont créés automatiquement
            lors des cueillettes, transformations et productions.
          </p>
        </div>
      ) : (
        <>
          {/* Filtres */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Recherche */}
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Rechercher variété, nom latin, famille…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
                style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
                aria-label="Rechercher"
              />
            </div>

            {/* Filtre famille */}
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

            {/* Filtre partie */}
            <select
              value={partieFilter}
              onChange={e => setPartieFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            >
              <option value="all">Toutes les parties</option>
              {parties.map(p => (
                <option key={p} value={p}>{PARTIE_PLANTE_LABELS[p as PartiePlante] ?? p}</option>
              ))}
            </select>

            {/* Toggle masquer zéros */}
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6B7B6C' }}>
              <input
                type="checkbox"
                checked={hideZero}
                onChange={e => setHideZero(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Masquer les zéros
            </label>
          </div>

          {/* Filtre par états */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <span className="text-xs font-medium mr-1" style={{ color: '#9CA89D' }}>États :</span>
            {ETATS_PLANTE.map(etat => {
              const active = etatFilters.size === 0 || etatFilters.has(etat)
              return (
                <button
                  key={etat}
                  onClick={() => toggleEtatFilter(etat)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
                  style={{
                    backgroundColor: active ? ETAT_PLANTE_COLORS[etat] + '22' : '#F3F4F6',
                    color: active ? ETAT_PLANTE_COLORS[etat] : '#9CA89D',
                    border: `1px solid ${active ? ETAT_PLANTE_COLORS[etat] + '44' : '#E5E7EB'}`,
                  }}
                >
                  {ETAT_PLANTE_LABELS[etat]}
                </button>
              )
            })}
            {etatFilters.size > 0 && (
              <button
                onClick={() => setEtatFilters(new Set())}
                className="px-2 py-1 text-xs underline"
                style={{ color: '#9CA89D' }}
              >
                Tous
              </button>
            )}
          </div>

          {/* Onglets tableau / graphique */}
          <div className="flex gap-1 mb-4">
            <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')}>
              Tableau
            </TabButton>
            <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
              Graphique
            </TabButton>
          </div>

          {activeTab === 'table' ? (
            /* ── Tableau pivot ── */
            displayed.length === 0 ? (
              <div
                className="text-center py-12 rounded-xl border"
                style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
              >
                <p className="text-sm">Aucun résultat ne correspond aux filtres.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#D8E0D9' }}>
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9', position: 'sticky', top: 0, zIndex: 1 }}>
                      <Th>Variété</Th>
                      <Th>Partie</Th>
                      {ETATS_PLANTE.map(e => (
                        <Th key={e} align="right">
                          <span style={{ color: ETAT_PLANTE_COLORS[e] }}>{ETAT_PLANTE_LABELS[e]}</span>
                        </Th>
                      ))}
                      <Th align="right">TOTAL</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((row, i) => {
                      const partieStyle = PARTIE_COLORS[row.partie_plante as PartiePlante] ?? PARTIE_COLORS.plante_entiere
                      return (
                        <tr
                          key={`${row.variety_id}-${row.partie_plante}`}
                          style={{
                            backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                            borderBottom: '1px solid #EDE8E0',
                          }}
                        >
                          <td className="px-4 py-2.5 font-medium" style={{ color: '#2C3E2D' }}>
                            <div>{row.nom_vernaculaire}</div>
                            {row.nom_latin && (
                              <div className="text-xs italic" style={{ color: '#9CA89D' }}>{row.nom_latin}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: partieStyle.bg, color: partieStyle.color }}
                            >
                              {PARTIE_PLANTE_LABELS[row.partie_plante as PartiePlante] ?? row.partie_plante}
                            </span>
                          </td>
                          {ETATS_PLANTE.map(etat => {
                            const val = row[etat]
                            return (
                              <td key={etat} className="px-4 py-2.5 text-right whitespace-nowrap" style={{ color: val < 0 ? '#DC2626' : '#2C3E2D' }}>
                                <WeightCell g={val} />
                              </td>
                            )
                          })}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold" style={{ color: row.total < 0 ? '#DC2626' : '#2C3E2D' }}>
                            <WeightCell g={row.total} />
                          </td>
                        </tr>
                      )
                    })}

                    {/* Ligne de totaux */}
                    <tr style={{ backgroundColor: '#F0EDE6', borderTop: '2px solid #D8E0D9' }}>
                      <td className="px-4 py-3 font-semibold text-sm" style={{ color: '#2C3E2D' }} colSpan={2}>
                        TOTAL
                      </td>
                      {ETATS_PLANTE.map(etat => (
                        <td key={etat} className="px-4 py-3 text-right whitespace-nowrap font-semibold text-sm" style={{ color: '#2C3E2D' }}>
                          <WeightCell g={totals[etat]} />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-sm" style={{ color: '#2C3E2D' }}>
                        <WeightCell g={totals.total} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* ── Graphique barres empilées ── */
            chartData.length === 0 ? (
              <div
                className="text-center py-12 rounded-xl border"
                style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
              >
                <p className="text-sm">Aucune donnée à afficher.</p>
              </div>
            ) : (
              <div className="rounded-xl border p-4" style={{ borderColor: '#D8E0D9', backgroundColor: '#FAFAF8' }}>
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
                    <Bar dataKey="Frais" stackId="a" fill={ETAT_PLANTE_COLORS.frais} />
                    <Bar dataKey="Tronçonnée" stackId="a" fill={ETAT_PLANTE_COLORS.tronconnee} />
                    <Bar dataKey="Séchée" stackId="a" fill={ETAT_PLANTE_COLORS.sechee} />
                    <Bar dataKey="Tronç. séchée" stackId="a" fill={ETAT_PLANTE_COLORS.tronconnee_sechee} />
                    <Bar dataKey="Séch. triée" stackId="a" fill={ETAT_PLANTE_COLORS.sechee_triee} />
                    <Bar dataKey="Tronç. séch. triée" stackId="a" fill={ETAT_PLANTE_COLORS.tronconnee_sechee_triee} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

/* ─── Sous-composants ─── */

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

/** Cellule de poids avec formatage et couleur conditionnelle */
function WeightCell({ g }: { g: number }) {
  if (g === 0) return <span style={{ color: '#D8E0D9' }}>—</span>
  if (g < 0) return <span style={{ color: '#DC2626' }}>⚠️ {formatWeight(g)}</span>
  return <>{formatWeight(g)}</>
}

/** Onglet tableau/graphique */
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

/** Menu export CSV / XLSX */
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
          {/* Overlay fermeture */}
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

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
