'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import type { ForecastWithVariety } from '@/lib/types'
import type { RealisedData } from '@/app/[orgSlug]/(dashboard)/previsionnel/actions'
import {
  ETATS_PLANTE,
  ETAT_PLANTE_LABELS,
  ETAT_PLANTE_COLORS,
  type EtatPlanteValue,
} from '@/lib/constants/etat-plante'
import { PARTIE_PLANTE_LABELS, type PartiePlante } from '@/lib/types'
import {
  fetchForecasts,
  fetchForecastYears,
  fetchRealisedData,
  upsertForecast,
  deleteForecast,
  copyForecastsFromYear,
} from '@/app/[orgSlug]/(dashboard)/previsionnel/actions'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { normalize } from '@/lib/utils/normalize'

const PREVISIONNEL_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'partie_plante', label: 'Partie', format: (v) => v ? PARTIE_PLANTE_LABELS[v as PartiePlante] ?? String(v) : 'Toutes' },
  { key: 'etat_plante', label: 'État' },
  { key: 'quantite_prevue_g', label: 'Objectif (g)' },
  { key: '_realise_g', label: 'Réalisé (g)' },
  { key: '_avancement_pct', label: 'Avancement (%)' },
  { key: 'commentaire', label: 'Commentaire' },
]

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */


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
  if (pct > 100) return '#3B82F6'
  if (pct >= 80) return '#22C55E'
  if (pct >= 40) return '#F59E0B'
  return '#EF4444'
}

/** Récupère le réalisé pour un forecast selon son état et sa partie de plante */
function getRealisedForForecast(
  forecast: ForecastWithVariety,
  realisedData: RealisedData,
): number {
  const partie = forecast.partie_plante ?? null

  if (forecast.etat_plante === 'frais') {
    if (partie) {
      // Partie précisée : match exact
      return realisedData.cueilliParVarietePartie[`${forecast.variety_id}:${partie}`] ?? 0
    }
    // Pas de partie : sommer toutes les parties (rétro-compat)
    return Object.entries(realisedData.cueilliParVarietePartie)
      .filter(([k]) => k.startsWith(`${forecast.variety_id}:`))
      .reduce((sum, [, v]) => sum + v, 0)
  }

  if (forecast.etat_plante) {
    if (partie) {
      const key = `${forecast.variety_id}:${partie}:${forecast.etat_plante}`
      return realisedData.stockParVarietePartieEtat[key] ?? 0
    }
    // Pas de partie : sommer toutes les parties pour cet état
    const suffix = `:${forecast.etat_plante}`
    return Object.entries(realisedData.stockParVarietePartieEtat)
      .filter(([k]) => k.startsWith(`${forecast.variety_id}:`) && k.endsWith(suffix))
      .reduce((sum, [, v]) => sum + v, 0)
  }

  return 0
}

/* ---------------------------------------------------------------
   Types props
--------------------------------------------------------------- */

type VarietyOption = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  parties_utilisees: PartiePlante[]
}

type Props = {
  initialForecasts: ForecastWithVariety[]
  initialYears: number[]
  initialYear: number
  allVarieties: VarietyOption[]
  initialRealisedData: RealisedData
}

/* ---------------------------------------------------------------
   Composant principal
--------------------------------------------------------------- */

export default function PrevisionnelClient({
  initialForecasts,
  initialYears,
  initialYear,
  allVarieties,
  initialRealisedData,
}: Props) {
  const [forecasts, setForecasts] = useState(initialForecasts)
  const [years, setYears] = useState(initialYears)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [realisedData, setRealisedData] = useState(initialRealisedData)
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [isPending, startTransition] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)

  // Copie
  const [copySource, setCopySource] = useState<number | null>(null)
  const [copyConfirm, setCopyConfirm] = useState<{ source: number; overwrite: boolean } | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  // Ajout d'objectif
  const [showAddForm, setShowAddForm] = useState(false)

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

  /* ---- Résumé — uniquement les objectifs "frais" ---- */
  const fraisForecasts = filtered.filter(f => f.etat_plante === 'frais')
  const totalPrevuFrais = fraisForecasts.reduce((sum, f) => sum + (f.quantite_prevue_g ?? 0), 0)
  const totalRealiseFrais = fraisForecasts.reduce(
    (sum, f) => sum + getRealisedForForecast(f, realisedData),
    0,
  )

  /** Recharge les données après un changement d'année */
  const reloadYear = useCallback((year: number) => {
    setLoadError(null)
    startTransition(async () => {
      try {
        const [newForecasts, newRealised] = await Promise.all([
          fetchForecasts(year),
          fetchRealisedData(year),
        ])
        setForecasts(newForecasts)
        setRealisedData(newRealised)
      } catch {
        setLoadError('Impossible de charger les données. Vérifiez votre connexion.')
      }
    })
  }, [])

  /** Recharge après copie (inclut les années) */
  const reloadAfterCopy = useCallback(() => {
    setLoadError(null)
    startTransition(async () => {
      try {
        const [newForecasts, newRealised, newYears] = await Promise.all([
          fetchForecasts(selectedYear),
          fetchRealisedData(selectedYear),
          fetchForecastYears(),
        ])
        setForecasts(newForecasts)
        setRealisedData(newRealised)
        setYears(newYears)
      } catch {
        setLoadError('Impossible de recharger après la copie. Vérifiez votre connexion.')
      }
    })
  }, [selectedYear])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-primary)' }}>
          Prévisionnel
        </h1>
        <ExportButton
          data={filtered.map(f => {
            const realise = getRealisedForForecast(f, realisedData)
            return { ...f, _realise_g: realise, _avancement_pct: computePercent(realise, f.quantite_prevue_g ?? 0) }
          }) as unknown as Record<string, unknown>[]}
          columns={PREVISIONNEL_EXPORT_COLUMNS}
          filename={`previsionnel_${selectedYear}`}
          variant="compact"
        />
      </div>

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
              reloadYear(y)
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
            reloadAfterCopy()
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
          aria-label="Rechercher"
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

      {/* ── Erreur de chargement ── */}
      {loadError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Variété</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600">Partie</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600">État</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">Objectif (g)</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-600">Réalisé</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-[140px]">Avancement</th>
              <th className="text-center px-2 py-2.5 font-medium text-gray-600 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {forecasts.length === 0
                    ? 'Aucun objectif défini pour cette année. Ajoutez un objectif pour commencer.'
                    : 'Aucun résultat pour cette recherche.'}
                </td>
              </tr>
            )}
            {filtered.map((f, idx) => {
              // Déterminer si c'est la première ligne de cette variété+partie (pour afficher le nom)
              const prevForecast = idx > 0 ? filtered[idx - 1] : null
              const isFirstOfVariety = !prevForecast || prevForecast.variety_id !== f.variety_id || prevForecast.partie_plante !== f.partie_plante

              return (
                <ForecastRow
                  key={f.id}
                  forecast={f}
                  realisedG={getRealisedForForecast(f, realisedData)}
                  year={selectedYear}
                  isFirstOfVariety={isFirstOfVariety}
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Bouton Ajouter ── */}
      <div className="mt-3">
        {showAddForm ? (
          <AddForecastForm
            varieties={allVarieties}
            existingForecasts={forecasts}
            onAdd={async (varietyId, etatPlante, partiePlante: PartiePlante | null, qty) => {
              const variety = allVarieties.find(v => v.id === varietyId)
              if (!variety) return { error: 'Variété introuvable' }

              const result = await upsertForecast({
                variety_id: varietyId,
                annee: selectedYear,
                quantite_prevue_g: qty,
                etat_plante: etatPlante,
                partie_plante: partiePlante,
              })

              if ('error' in result) return result

              // Ajouter localement
              const newForecast: ForecastWithVariety = {
                id: result.data?.id ?? crypto.randomUUID(),
                farm_id: '',
                annee: selectedYear,
                variety_id: varietyId,
                etat_plante: etatPlante,
                partie_plante: partiePlante,
                quantite_prevue_g: qty,
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
              setForecasts(prev => {
                const updated = [...prev, newForecast]
                // Retrier par variété puis partie puis état
                const etatOrder: Record<string, number> = {
                  frais: 0, tronconnee: 1, sechee: 2,
                  tronconnee_sechee: 3, sechee_triee: 4, tronconnee_sechee_triee: 5,
                }
                updated.sort((a, b) => {
                  const famA = a.varieties?.famille ?? 'zzz'
                  const famB = b.varieties?.famille ?? 'zzz'
                  if (famA !== famB) return famA.localeCompare(famB, 'fr')
                  const nomA = a.varieties?.nom_vernaculaire ?? ''
                  const nomB = b.varieties?.nom_vernaculaire ?? ''
                  if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr')
                  const partA = a.partie_plante ?? ''
                  const partB = b.partie_plante ?? ''
                  if (partA !== partB) return partA.localeCompare(partB, 'fr')
                  return (etatOrder[a.etat_plante ?? ''] ?? 99) - (etatOrder[b.etat_plante ?? ''] ?? 99)
                })
                return updated
              })

              return { success: true }
            }}
            onClose={() => setShowAddForm(false)}
          />
        ) : (
          <button
            className="text-sm px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => setShowAddForm(true)}
          >
            + Ajouter un objectif
          </button>
        )}
      </div>

      {/* ── Résumé ── */}
      {filtered.length > 0 && (
        <div className="mt-6 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-center gap-6 text-sm text-gray-600">
          <span>
            <strong className="text-gray-800">{filtered.length}</strong> objectif{filtered.length > 1 ? 's' : ''} défini{filtered.length > 1 ? 's' : ''}
          </span>
          {totalPrevuFrais > 0 && (
            <>
              <span>
                Récolte : <strong className="text-gray-800">{formatWeight(totalPrevuFrais)}</strong> prévus
              </span>
              <span>
                Réalisé : <strong className="text-gray-800">{formatWeight(totalRealiseFrais)}</strong>
              </span>
              <span>
                Avancement :{' '}
                <strong style={{ color: progressColor(computePercent(totalRealiseFrais, totalPrevuFrais)) }}>
                  {computePercent(totalRealiseFrais, totalPrevuFrais)}%
                </strong>
              </span>
            </>
          )}
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

/** Badge d'état plante */
function EtatBadge({ etat }: { etat: string }) {
  const label = ETAT_PLANTE_LABELS[etat as EtatPlanteValue] ?? etat
  const color = ETAT_PLANTE_COLORS[etat as EtatPlanteValue] ?? '#6B7280'

  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  )
}

/** Badge partie de plante */
function PartieBadge({ partie }: { partie: string }) {
  const label = PARTIE_PLANTE_LABELS[partie as PartiePlante] ?? partie
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: '#8B5CF618', color: '#8B5CF6', border: '1px solid #8B5CF640' }}
    >
      {label}
    </span>
  )
}

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

/** Ligne du tableau — un forecast (variété × état) */
function ForecastRow({
  forecast,
  realisedG,
  year,
  isFirstOfVariety,
  onUpdate,
  onUpdateComment,
  onDelete,
}: {
  forecast: ForecastWithVariety
  realisedG: number
  year: number
  isFirstOfVariety: boolean
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
      etat_plante: forecast.etat_plante ?? 'frais',
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
    const result = await upsertForecast({
      variety_id: forecast.variety_id,
      annee: year,
      quantite_prevue_g: forecast.quantite_prevue_g ?? 0,
      etat_plante: forecast.etat_plante ?? 'frais',
      partie_plante: forecast.partie_plante,
      commentaire: comment,
    })
    if ('error' in result) {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 2000)
      return
    }
    onUpdateComment(comment)
  }, [forecast, year, onUpdateComment])

  const handleDelete = useCallback(async () => {
    const result = await deleteForecast(forecast.id)
    if ('error' in result) {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 2000)
      return
    }
    onDelete()
  }, [forecast.id, onDelete])

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
        {/* Variété */}
        <td className="px-4 py-2.5">
          {isFirstOfVariety ? (
            <>
              <div className="font-medium text-gray-800">{forecast.varieties?.nom_vernaculaire ?? '—'}</div>
              {forecast.varieties?.nom_latin && (
                <div className="text-xs text-gray-400 italic">{forecast.varieties.nom_latin}</div>
              )}
            </>
          ) : (
            <span className="text-gray-300">↳</span>
          )}
        </td>

        {/* Partie */}
        <td className="px-3 py-2.5">
          {forecast.partie_plante ? (
            <PartieBadge partie={forecast.partie_plante} />
          ) : (
            <span className="text-xs text-gray-400 italic">Toutes</span>
          )}
        </td>

        {/* État */}
        <td className="px-3 py-2.5">
          {forecast.etat_plante ? (
            <EtatBadge etat={forecast.etat_plante} />
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>

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
          <td colSpan={7} className="px-4 py-2">
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

/** Formulaire d'ajout d'objectif (variété + partie + état + quantité) */
function AddForecastForm({
  varieties,
  existingForecasts,
  onAdd,
  onClose,
}: {
  varieties: VarietyOption[]
  existingForecasts: ForecastWithVariety[]
  onAdd: (varietyId: string, etatPlante: EtatPlanteValue, partiePlante: PartiePlante | null, qty: number) => Promise<{ error?: string; success?: boolean }>
  onClose: () => void
}) {
  const [selectedVariety, setSelectedVariety] = useState('')
  const [selectedPartie, setSelectedPartie] = useState<PartiePlante | null>(null)
  const [selectedEtat, setSelectedEtat] = useState<EtatPlanteValue>('frais')
  const [qty, setQty] = useState('')
  const [varietySearch, setVarietySearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const normalizedSearch = normalize(varietySearch)
  const filteredVarieties = varieties.filter(v =>
    normalize(v.nom_vernaculaire).includes(normalizedSearch),
  )

  // Parties disponibles pour la variété sélectionnée
  const selectedVarietyObj = varieties.find(v => v.id === selectedVariety)
  const availableParties = selectedVarietyObj?.parties_utilisees ?? []

  // Bug fix #2 : réinitialiser la sélection si la variété choisie n'est plus dans la liste filtrée
  const varietyStillVisible = !selectedVariety || filteredVarieties.some(v => v.id === selectedVariety)
  if (!varietyStillVisible) {
    setSelectedVariety('')
    setSelectedPartie(null)
  }

  // Grouper par famille
  const grouped = new Map<string, VarietyOption[]>()
  for (const v of filteredVarieties) {
    const key = v.famille ?? 'Sans famille'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(v)
  }

  // Vérifier si le triplet variété × partie × état existe déjà
  const isDuplicate = existingForecasts.some(
    f => f.variety_id === selectedVariety
      && f.etat_plante === selectedEtat
      && f.partie_plante === selectedPartie,
  )

  const handleSubmit = async () => {
    if (!selectedVariety) {
      setError('Sélectionnez une variété')
      return
    }
    if (availableParties.length > 1 && !selectedPartie) {
      setError('Sélectionnez une partie de plante')
      return
    }
    if (isDuplicate) {
      setError('Cet objectif existe déjà pour cette variété, partie et état')
      return
    }
    const numQty = parseFloat(qty)
    if (isNaN(numQty) || numQty < 0) {
      setError('Quantité invalide')
      return
    }

    setSaving(true)
    setError(null)
    const result = await onAdd(selectedVariety, selectedEtat, selectedPartie, numQty)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    // Réinitialiser le formulaire (garder ouvert pour ajouts multiples)
    setSelectedVariety('')
    setSelectedPartie(null)
    setSelectedEtat('frais')
    setQty('')
    setError(null)
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm max-w-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Ajouter un objectif</h3>
        <button
          className="text-sm text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>

      {/* Variété */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">Variété</label>
        <input
          type="text"
          placeholder="Rechercher une variété..."
          className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 mb-1"
          value={varietySearch}
          onChange={e => setVarietySearch(e.target.value)}
          aria-label="Rechercher"
        />
        <select
          className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
          value={selectedVariety}
          onChange={e => {
            const vid = e.target.value
            setSelectedVariety(vid)
            // Auto-sélectionner la partie si une seule disponible
            const v = varieties.find(x => x.id === vid)
            const parts = v?.parties_utilisees ?? []
            setSelectedPartie(parts.length === 1 ? parts[0] : null)
            setError(null)
          }}
          size={8}
        >
          <option value="" disabled>
            — Choisir une variété —
          </option>
          {Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'fr'))
            .map(([famille, vars]) => (
              <optgroup key={famille} label={famille}>
                {vars.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}
                    {v.nom_latin ? ` (${v.nom_latin})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
        {/* Feedback visuel : variété sélectionnée */}
        {selectedVarietyObj && (
          <p className="text-xs text-green-600 mt-1">
            ✓ {selectedVarietyObj.nom_vernaculaire}
          </p>
        )}
      </div>

      {/* Partie de plante — affiché uniquement si la variété a plusieurs parties */}
      {selectedVariety && availableParties.length > 1 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Partie de plante</label>
          <select
            className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
            value={selectedPartie ?? ''}
            onChange={e => { setSelectedPartie((e.target.value || null) as PartiePlante | null); setError(null) }}
          >
            <option value="">— Choisir une partie —</option>
            {availableParties.map(p => (
              <option key={p} value={p}>
                {PARTIE_PLANTE_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Info : partie auto-sélectionnée */}
      {selectedVariety && availableParties.length === 1 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Partie de plante</label>
          <p className="text-sm text-gray-600">
            {PARTIE_PLANTE_LABELS[availableParties[0]] ?? availableParties[0]} <span className="text-xs text-gray-400">(seule partie)</span>
          </p>
        </div>
      )}

      {/* État plante */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">État plante</label>
        <select
          className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
          value={selectedEtat}
          onChange={e => { setSelectedEtat(e.target.value as EtatPlanteValue); setError(null) }}
        >
          {ETATS_PLANTE.map(etat => (
            <option key={etat} value={etat}>
              {ETAT_PLANTE_LABELS[etat]}
            </option>
          ))}
        </select>
      </div>

      {/* Quantité */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">Objectif (g)</label>
        <input
          type="number"
          min={0}
          step={100}
          placeholder="Ex: 50000"
          className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5"
          value={qty}
          onChange={e => setQty(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        />
      </div>

      {/* Avertissement doublon */}
      {isDuplicate && selectedVariety && (
        <p className="text-xs text-amber-600 mb-2">
          Cet objectif existe déjà pour cette variété, partie et état.
        </p>
      )}

      {/* Erreur */}
      {error && !isDuplicate && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="text-sm px-4 py-1.5 rounded-md text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
          disabled={saving || !selectedVariety || isDuplicate || (availableParties.length > 1 && !selectedPartie)}
          onClick={handleSubmit}
        >
          {saving ? 'Enregistrement...' : 'Ajouter'}
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-600"
          onClick={onClose}
        >
          Fermer
        </button>
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
