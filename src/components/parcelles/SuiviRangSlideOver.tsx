'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { RowCareWithRelations, RowWithParcel, Variety, ActionResult } from '@/lib/types'
import { useRowVarieties } from '@/hooks/useRowVarieties'

type Props = {
  open: boolean
  rowCare: RowCareWithRelations | null
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const TYPE_SOIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'desherbage', label: 'Desherbage' },
  { value: 'paillage', label: 'Paillage' },
  { value: 'arrosage', label: 'Arrosage' },
  { value: 'autre', label: 'Autre' },
]

/** Groupe les rangs par "Site — Parcelle" pour les optgroups */
function groupRowsByParcel(rows: RowWithParcel[]): Map<string, { label: string; rows: RowWithParcel[] }> {
  const groups = new Map<string, { label: string; rows: RowWithParcel[] }>()

  for (const row of rows) {
    const parcel = row.parcels as { id?: string; nom?: string; code?: string; sites?: { nom?: string } | null } | null
    const siteName = parcel?.sites?.nom ?? ''
    const parcelName = parcel?.nom ?? ''
    const parcelCode = parcel?.code ?? ''
    const groupKey = `${siteName}__${parcelName}`
    const groupLabel = siteName
      ? `${siteName} — ${parcelName} (${parcelCode})`
      : `${parcelName} (${parcelCode})`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: groupLabel, rows: [] })
    }
    groups.get(groupKey)!.rows.push(row)
  }

  return groups
}

export default function SuiviRangSlideOver({
  open,
  rowCare,
  rows,
  varieties: catalogVarieties,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const isEdit = rowCare !== null

  // ---- State du formulaire ----
  const [selectedRowId, setSelectedRowId] = useState(rowCare?.row_id ?? '')
  const [selectedVarietyId, setSelectedVarietyId] = useState(rowCare?.variety_id ?? '')

  // ---- Hook logique adaptative variete ----
  const { varieties: rowVarieties, loading: loadingVarieties, autoVariety } = useRowVarieties(
    selectedRowId || null,
  )

  // Auto-remplissage variete quand le hook retourne 1 seule variete
  const prevAutoRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoVariety && autoVariety.id !== prevAutoRef.current) {
      setSelectedVarietyId(autoVariety.id)
      prevAutoRef.current = autoVariety.id
    }
  }, [autoVariety])

  // Resync a l'ouverture/changement de rowCare
  useEffect(() => {
    setSelectedRowId(rowCare?.row_id ?? '')
    setSelectedVarietyId(rowCare?.variety_id ?? '')
    setError(null)
    prevAutoRef.current = null
  }, [rowCare])

  // Focus premier champ
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  function handleRowChange(rowId: string) {
    setSelectedRowId(rowId)
    setSelectedVarietyId('')
    prevAutoRef.current = null
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('row_id', selectedRowId)
    fd.set('variety_id', selectedVarietyId)

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const rowGroups = groupRowsByParcel(rows)

  // Determiner la source du select variete
  const hasRowVarieties = rowVarieties.length > 0
  const hasMultipleVarieties = rowVarieties.length > 1
  const hasNoVarieties = !loadingVarieties && selectedRowId && rowVarieties.length === 0
  const varietyOptions = hasRowVarieties ? rowVarieties : catalogVarieties

  return (
    <>
      {/* ---- Overlay ---- */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ---- Panneau ---- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier le suivi de rang' : 'Nouveau suivi de rang'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '480px',
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tete */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            {isEdit ? 'Modifier le suivi de rang' : 'Nouveau suivi de rang'}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9CA89D' }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-6 py-5 space-y-5 flex-1">

            {/* Rang */}
            <Field label="Rang" required>
              <select
                ref={firstFieldRef}
                name="row_id"
                required
                value={selectedRowId}
                onChange={e => handleRowChange(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Selectionner un rang</option>
                {Array.from(rowGroups.entries()).map(([groupKey, group]) => (
                  <optgroup key={groupKey} label={group.label}>
                    {group.rows.map(row => (
                      <option key={row.id} value={row.id}>
                        Rang {row.numero}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* Indicateur de chargement des varietes */}
            {loadingVarieties && selectedRowId && (
              <div className="text-xs" style={{ color: '#9CA89D' }}>
                Chargement des varietes du rang…
              </div>
            )}

            {/* Avertissement : aucune variete active */}
            {hasNoVarieties && (
              <WarningBanner>
                Aucune variete active sur ce rang. Le catalogue complet est propose.
              </WarningBanner>
            )}

            {/* Bandeau multi-varietes */}
            {hasMultipleVarieties && (
              <WarningBanner>
                Ce rang a {rowVarieties.length} varietes actives. Selectionnez celle concernee. Vous pouvez ajouter une entree pour chaque variete.
              </WarningBanner>
            )}

            {/* Variete */}
            <Field label="Variete" required>
              <select
                name="variety_id"
                required
                value={selectedVarietyId}
                onChange={e => setSelectedVarietyId(e.target.value)}
                disabled={isPending || loadingVarieties}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Selectionner une variete</option>
                {varietyOptions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}
                  </option>
                ))}
              </select>
              {autoVariety && selectedVarietyId === autoVariety.id && (
                <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                  Variete auto-selectionnee (seule variete active sur ce rang)
                </p>
              )}
            </Field>

            {/* Date */}
            <Field label="Date" required>
              <input
                name="date"
                type="date"
                required
                defaultValue={rowCare?.date ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Type de soin */}
            <Field label="Type de soin" required>
              <select
                name="type_soin"
                required
                defaultValue={rowCare?.type_soin ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Selectionner un type</option>
                {TYPE_SOIN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            {/* Temps */}
            <Field label="Temps (min)">
              <input
                name="temps_min"
                type="number"
                min="1"
                step="1"
                defaultValue={rowCare?.temps_min ?? ''}
                disabled={isPending}
                placeholder="en minutes"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={rowCare?.commentaire ?? ''}
                disabled={isPending}
                placeholder="Observations…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Erreur */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: '#FDF3E8',
                  color: '#BC6C25',
                  border: '1px solid #DDA15E44',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Pied : boutons */}
          <div
            className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
            style={{ borderTop: '1px solid #D8E0D9' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Creation…'
                : isEdit ? 'Enregistrer' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Helpers de style ---- */
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  borderRadius: '8px',
  border: '1px solid #D8E0D9',
  backgroundColor: '#F9F8F6',
  color: '#2C3E2D',
  outline: 'none',
}

function focusStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = 'var(--color-primary)'
}
function blurStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = '#D8E0D9'
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
        {label}
        {required && <span style={{ color: '#BC6C25' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

/** Bandeau d'avertissement */
function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs px-3 py-2 rounded-lg"
      style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B44' }}
    >
      ⚠️ {children}
    </div>
  )
}
