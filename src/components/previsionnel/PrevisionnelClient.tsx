'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import type { ForecastWithVariety } from '@/lib/types'
import {
  fetchForecasts,
  fetchForecastYears,
  fetchRealisedByVariety,
  upsertForecast,
  deleteForecast,
  copyForecastsFromYear,
} from '@/app/[orgSlug]/(dashboard)/previsionnel/actions'

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */

/** Normalise une chaîne (minuscule, sans accents) pour la recherche */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Formate un poids en grammes vers un affichage lisible */
function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`
  return `${Math.round(grams)} g`
}

/** Calcule le pourcentage d'avancement */
function computePercent(realised: number, objective: number): number {
  if (objective <= 0) return 0
  return Math.round((realised / objective) * 100)
}

/** Couleur de la barre de progression selon le pourcentage */
function progressColor(pct: number): string {
  if (pct > 100) return '#3B82F6'  // bleu
  if (pct >= 80) return '#22C55E'  // vert
  if (pct >= 40) return '#F59E0B'  // orange
  return '#EF4444'                  // rouge
}

/* ---------------------------------------------------------------
   Types props
--------------------------------------------------------------- */

type VarietyOption = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
}

type Props = {
  initialForecasts: ForecastWithVariety[]
  initialYears: number[]
  initialYear: number
  allVarieties: VarietyOption[]
  initialRealised: Record<string, number>
}

/* ---------------------------------------------------------------
   Composant principal
--------------------------------------------------------------- */

export default function PrevisionnelClient({
  initialForecasts,
  initialYears,
  initialYear,
  allVarieties,
  initialRealised,
}: Props) {
  const [forecasts, setForecasts] = useState(initialForecasts)
  const [years, setYears] = useState(initialYears)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [realised, setRealised] = useState(initialRealised)
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()

  // Copie
  const [copySource, setCopySource] = useState<number | null>(null)
  const [copyConfirm, setCopyConfirm] = useState<{ source: number; overwrite: boolean } | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  // Ajout de variété
  const [showAddSelect, setShowAddSelect] = useState(false)

  /* ---- Familles disponibles ---- */
  const families = Array.from(
    new Set(forecasts.map(f => f.varieties?.famille).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b, 'fr'))

  /* ---- Filtrage ---- */
  const normalizedSearch = normalize(search)
  const filtered = forecasts.filter(f => {
    const nom = f.varieties?.nom_vernaculaire ?? ''
    if (normalizedSearch && !normalize(nom).includes(normalizedSearch)) return false
    if (familyFilter !== 'all' && (f.varieties?.famille ?? '') !== familyFilter) return false
    return true
  })

  /* ---- Variétés disponibles pour ajout (non déjà dans les forecasts) ---- */
  const forecastVarietyIds = new Set(forecasts.map(f => f.variety_id))
  const availableVarieties = allVarieties.filter(v => !forecastVarietyIds.has(v.id))

  /* ---- Résumé ---- */
  const totalPrevu = filtered.reduce((sum, f) => sum + (f.quantite_prevue_g ?? 0), 0)
  const totalRealise = filtered.reduce((sum, f) => sum + (realised[f.variety_id] ?? 0), 0)
  const globalPercent = totalPrevu > 0 ? Math.round((totalRealise / totalPrevu) * 100) : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
        Prévisionnel
      </h1>

      {/* ── Sélecteur d'année + Copie ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-600">Année :</span>
        {years.map(y => (
          <YearButton
            key={y}
            year={y}
            active={y === selectedYear}
            onClick={() => {
              setSelectedYear(y)
              startTransition(async () => {
                try {
                  const [newForecasts, newRealised] = await Promise.all([
                    fetchForecasts(y),
                    fetchRealisedByVariety(y),
                  ])
                  setForecasts(newForecasts)
                  setRealised(newRealised)
                } catch {
                  // Erreur silencieuse — les données restent inchangées
                }
              })
            }}
          />
        ))}

        <div className="ml-auto flex items-center gap-2">
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
            value={copySource ?? ''}
            onChange={e => setCopySource(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Copier depuis...</option>
            {years.filter(y => y !== selectedYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {copySource && (
            <button
              className="text-sm px-3 py-1.5 rounded-md text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onClick={() => setCopyConfirm({ source: copySource, overwrite: false })}
            >
              Copier
            </button>
          )}
        </div>
      </div>

      {/* ── Modale de confirmation copie ── */}
      {copyConfirm && (
        <CopyConfirmDialog
          source={copyConfirm.source}
          target={selectedYear}
          existingCount={forecasts.length}
          error={copyError}
          onConfirm={async (overwrite) => {
            setCopyError(null)
            const result = await copyForecastsFromYear(copyConfirm.source, selectedYear, overwrite)
            if ('error' in result) {
              if (result.error.includes('a déjà') && !overwrite) {
                setCopyConfirm({ ...copyConfirm, overwrite: true })
                setCopyError(result.error)
                return
              }
              setCopyError(result.error)
              return
            }
            setCopyConfirm(null)
            setCopySource(null)
            // Recharger
            startTransition(async () => {
              try {
                const [newForecasts, newRealised, newYears] = await Promise.all([
                  fetchForecasts(selectedYear),
                  fetchRealisedByVariety(selectedYear),
                  fetchForecastYears(),
                ])
                setForecasts(newForecasts)
                setRealised(newRealised)
                setYears(newYears)
              } catch {
                // Silencieux
              }
            })
          }}
          onCancel={() => { setCopyConfirm(null); setCopyError(null) }}
        />
      )}

      {/* ── Recherche et filtre ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher une variété..."
          className="flex-1 min-w-[200px] text-sm border border-gray-300 rounded-md px-3 py-1.5"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          value={familyFilter}
          onChange={e => setFamilyFilter(e.target.value)}
        >
          <option value="all">Toutes les familles</option>
          {families.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* ── Tableau ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Variété</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600">Famille</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">Objectif (g)</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">Réalisé</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-[140px]">Avancement</th>
              <th className="text-center px-2 py-2.5 font-medium text-gray-600 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {forecasts.length === 0
                    ? 'Aucun objectif défini pour cette année. Ajoutez une variété pour commencer.'
                    : 'Aucun résultat pour cette recherche.'}
                </td>
              </tr>
            )}
            {filtered.map(f => (
              <ForecastRow
                key={f.id}
                forecast={f}
                realisedG={realised[f.variety_id] ?? 0}
                year={selectedYear}
                onUpdate={(newQty) => {
                  setForecasts(prev =>
                    prev.map(fc =>
                      fc.id === f.id ? { ...fc, quantite_prevue_g: newQty } : fc,
                    ),
                  )
                }}
                onUpdateComment={(comment) => {
                  setForecasts(prev =>
                    prev.map(fc =>
                      fc.id === f.id ? { ...fc, commentaire: comment } : fc,
                    ),
                  )
                }}
                onDelete={() => {
                  setForecasts(prev => prev.filter(fc => fc.id !== f.id))
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Bouton Ajouter ── */}
      <div className="mt-3">
        {showAddSelect ? (
          <AddVarietySelect
            varieties={availableVarieties}
            year={selectedYear}
            onAdd={async (varietyId) => {
              const variety = allVarieties.find(v => v.id === varietyId)
              if (!variety) return

              const result = await upsertForecast({
                variety_id: varietyId,
                annee: selectedYear,
                quantite_prevue_g: 0,
              })

              if ('error' in result) return

              // Ajouter localement
              const newForecast: ForecastWithVariety = {
                id: result.data?.id ?? crypto.randomUUID(),
                farm_id: '',
                annee: selectedYear,
                variety_id: varietyId,
                etat_plante: null,
                partie_plante: null,
                quantite_prevue_g: 0,
                commentaire: null,
                created_by: null,
                updated_by: null,
                created_at: new Date().toISOString(),
                varieties: {
                  id: variety.id,
                  nom_vernaculaire: variety.nom_vernaculaire,
                  nom_latin: variety.nom_latin,
                  famille: variety.famille,
                },
              }
              setForecasts(prev => [...prev, newForecast])
              setShowAddSelect(false)
            }}
            onCancel={() => setShowAddSelect(false)}
          />
        ) : (
          <button
            className="text-sm px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => setShowAddSelect(true)}
          >
            + Ajouter une variété
          </button>
        )}
      </div>

      {/* ── Résumé ── */}
      {filtered.length > 0 && (
        <div className="mt-6 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-center gap-6 text-sm text-gray-600">
          <span>
            <strong className="text-gray-800">{filtered.length}</strong> variété{filtered.length > 1 ? 's' : ''} avec objectif
          </span>
          <span>
            Total prévu : <strong className="text-gray-800">{formatWeight(totalPrevu)}</strong>
          </span>
          <span>
            Réalisé : <strong className="text-gray-800">{formatWeight(totalRealise)}</strong>
          </span>
          <span>
            Avancement : <strong style={{ color: progressColor(globalPercent) }}>{globalPercent}%</strong>
          </span>
        </div>
      )}

      {/* ── Indicateur de chargement ── */}
      {isPending && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg px-4 py-2 text-sm text-gray-500 border">
          Chargement...
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------
   Sous-composants
--------------------------------------------------------------- */

/** Bouton année */
function YearButton({ year, active, onClick }: { year: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#fff' : '#6B7280',
        border: active ? 'none' : '1px solid #D1D5DB',
      }}
    >
      {year}
    </button>
  )
}

/** Ligne du tableau — un forecast */
function ForecastRow({
  forecast,
  realisedG,
  year,
  onUpdate,
  onUpdateComment,
  onDelete,
}: {
  forecast: ForecastWithVariety
  realisedG: number
  year: number
  onUpdate: (qty: number) => void
  onUpdateComment: (comment: string | null) => void
  onDelete: () => void
}) {
  const qty = forecast.quantite_prevue_g ?? 0
  const pct = computePercent(realisedG, qty)
  const inputRef = useRef<HTMLInputElement>(null)
  const [localQty, setLocalQty] = useState(String(qty))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [localComment, setLocalComment] = useState(forecast.commentaire ?? '')

  const saveQty = useCallback(async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 2000)
      return
    }

    setSaving(true)
    setSaveError(false)
    const result = await upsertForecast({
      variety_id: forecast.variety_id,
      annee: year,
      quantite_prevue_g: num,
      etat_plante: forecast.etat_plante,
      partie_plante: forecast.partie_plante,
      commentaire: forecast.commentaire,
    })

    setSaving(false)
    if ('error' in result) {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 2000)
      return
    }

    onUpdate(num)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [forecast, year, onUpdate])

  const saveComment = useCallback(async (value: string) => {
    const comment = value.trim() || null
    await upsertForecast({
      variety_id: forecast.variety_id,
      annee: year,
      quantite_prevue_g: forecast.quantite_prevue_g ?? 0,
      etat_plante: forecast.etat_plante,
      partie_plante: forecast.partie_plante,
      commentaire: comment,
    })
    onUpdateComment(comment)
  }, [forecast, year, onUpdateComment])

  const handleDelete = useCallback(async () => {
    await deleteForecast(forecast.id)
    onDelete()
  }, [forecast.id, onDelete])

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
        {/* Variété */}
        <td className="px-4 py-2.5">
          <div className="font-medium text-gray-800">{forecast.varieties?.nom_vernaculaire ?? '—'}</div>
          {forecast.varieties?.nom_latin && (
            <div className="text-xs text-gray-400 italic">{forecast.varieties.nom_latin}</div>
          )}
        </td>

        {/* Famille */}
        <td className="px-3 py-2.5 text-gray-500">{forecast.varieties?.famille ?? '—'}</td>

        {/* Objectif */}
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-2">
            <input
              ref={inputRef}
              type="number"
              min={0}
              step={100}
              className="w-[100px] text-right text-sm border rounded-md px-2 py-1"
              style={{
                borderColor: saveError ? '#EF4444' : '#D1D5DB',
              }}
              value={localQty}
              onChange={e => setLocalQty(e.target.value)}
              onBlur={() => saveQty(localQty)}
              onKeyDown={e => { if (e.key === 'Enter') saveQty(localQty) }}
            />
            {qty >= 1000 && (
              <span className="text-xs text-gray-400 w-[50px]">{formatWeight(qty)}</span>
            )}
            {saving && <span className="text-xs text-gray-400">...</span>}
            {saved && <span className="text-xs text-green-500">&#10003;</span>}
          </div>
        </td>

        {/* Réalisé */}
        <td className="px-3 py-2.5 text-right text-gray-600">{formatWeight(realisedG)}</td>

        {/* Avancement */}
        <td className="px-3 py-2.5">
          {qty > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: progressColor(pct),
                  }}
                />
              </div>
              <span
                className="text-xs font-medium w-[38px] text-right"
                style={{ color: progressColor(pct) }}
              >
                {pct}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-2 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              title="Commentaire"
              onClick={() => setShowComment(!showComment)}
            >
              <span className="text-xs">{forecast.commentaire ? '💬' : '🗨️'}</span>
            </button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded"
                  onClick={handleDelete}
                >
                  Oui
                </button>
                <button
                  className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                className="p-1 rounded hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                title="Supprimer"
                onClick={() => setDeleteConfirm(true)}
              >
                <span className="text-xs">🗑️</span>
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Ligne commentaire */}
      {showComment && (
        <tr className="border-b border-gray-100 bg-gray-50/30">
          <td colSpan={6} className="px-4 py-2">
            <input
              type="text"
              placeholder="Commentaire..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5"
              value={localComment}
              onChange={e => setLocalComment(e.target.value)}
              onBlur={() => saveComment(localComment)}
              onKeyDown={e => { if (e.key === 'Enter') saveComment(localComment) }}
              autoFocus
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** Select pour ajouter une variété */
function AddVarietySelect({
  varieties,
  year,
  onAdd,
  onCancel,
}: {
  varieties: VarietyOption[]
  year: number
  onAdd: (varietyId: string) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const normalizedSearch = normalize(search)

  const filtered = varieties.filter(v =>
    normalize(v.nom_vernaculaire).includes(normalizedSearch),
  )

  // Grouper par famille
  const grouped = new Map<string, VarietyOption[]>()
  for (const v of filtered) {
    const key = v.famille ?? 'Sans famille'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(v)
  }

  return (
    <div className="border border-gray-300 rounded-lg p-3 bg-white shadow-sm max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Rechercher une variété..."
          className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <button
          className="text-sm text-gray-400 hover:text-gray-600"
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-2 text-center">Aucune variété disponible</p>
        )}
        {Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b, 'fr'))
          .map(([famille, vars]) => (
            <div key={famille}>
              <p className="text-xs font-medium text-gray-400 px-2 py-1 mt-1">{famille}</p>
              {vars.map(v => (
                <button
                  key={v.id}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
                  onClick={() => onAdd(v.id)}
                >
                  <span className="text-gray-800">{v.nom_vernaculaire}</span>
                  {v.nom_latin && (
                    <span className="text-xs text-gray-400 ml-2 italic">{v.nom_latin}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

/** Dialogue de confirmation de copie */
function CopyConfirmDialog({
  source,
  target,
  existingCount,
  error,
  onConfirm,
  onCancel,
}: {
  source: number
  target: number
  existingCount: number
  error: string | null
  onConfirm: (overwrite: boolean) => void
  onCancel: () => void
}) {
  const needOverwrite = existingCount > 0

  return (
    <div className="mb-4 border border-amber-200 bg-amber-50 rounded-lg p-4">
      <p className="text-sm text-gray-700">
        {needOverwrite
          ? `⚠️ ${target} a déjà ${existingCount} objectif(s). Écraser et copier depuis ${source} ?`
          : `Copier les objectifs de ${source} vers ${target} ?`}
      </p>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          className="text-sm px-3 py-1.5 rounded-md text-white"
          style={{ backgroundColor: needOverwrite ? '#EF4444' : 'var(--color-primary)' }}
          onClick={() => onConfirm(needOverwrite)}
        >
          {needOverwrite ? 'Écraser et copier' : 'Copier'}
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-600"
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
