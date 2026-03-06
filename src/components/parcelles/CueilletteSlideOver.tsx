'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { HarvestWithRelations, RowWithParcel, Variety, PartiePlante, ActionResult } from '@/lib/types'
import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'
import { useRowVarieties } from '@/hooks/useRowVarieties'
import { useVarietyParts } from '@/hooks/useVarietyParts'

type Props = {
  open: boolean
  harvest: HarvestWithRelations | null
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  lieuxSauvages: string[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

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

export default function CueilletteSlideOver({
  open,
  harvest,
  rows,
  varieties: catalogVarieties,
  lieuxSauvages,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLButtonElement>(null)

  const isEdit = harvest !== null

  // ---- State du formulaire ----
  const [typeCueillette, setTypeCueillette] = useState<'parcelle' | 'sauvage'>(
    harvest?.type_cueillette ?? 'parcelle',
  )
  const [selectedRowId, setSelectedRowId] = useState(harvest?.row_id ?? '')
  const [selectedVarietyId, setSelectedVarietyId] = useState(harvest?.variety_id ?? '')
  const [selectedPartie, setSelectedPartie] = useState<string>(harvest?.partie_plante ?? '')

  // ---- Hook logique adaptative variete (mode parcelle uniquement) ----
  const { varieties: rowVarieties, loading: loadingVarieties, autoVariety } = useRowVarieties(
    typeCueillette === 'parcelle' && selectedRowId ? selectedRowId : null,
  )

  // ---- Hook logique adaptative partie_plante ----
  const { parts, loading: loadingParts, autoPart } = useVarietyParts(
    selectedVarietyId || null,
  )

  // Auto-remplissage variete quand le hook retourne 1 seule variete
  const prevAutoVarietyRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoVariety && autoVariety.id !== prevAutoVarietyRef.current) {
      setSelectedVarietyId(autoVariety.id)
      prevAutoVarietyRef.current = autoVariety.id
    }
  }, [autoVariety])

  // Auto-remplissage partie_plante quand le hook retourne 1 seule partie
  const prevAutoPartRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoPart && autoPart !== prevAutoPartRef.current) {
      setSelectedPartie(autoPart)
      prevAutoPartRef.current = autoPart
    }
  }, [autoPart])

  // Resync a l'ouverture/changement de harvest
  useEffect(() => {
    setTypeCueillette(harvest?.type_cueillette ?? 'parcelle')
    setSelectedRowId(harvest?.row_id ?? '')
    setSelectedVarietyId(harvest?.variety_id ?? '')
    setSelectedPartie(harvest?.partie_plante ?? '')
    setError(null)
    prevAutoVarietyRef.current = null
    prevAutoPartRef.current = null
  }, [harvest])

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

  function handleTypeChange(type: 'parcelle' | 'sauvage') {
    if (isEdit) return // Type non modifiable en edition
    setTypeCueillette(type)
    // Reset les champs dependant du type
    setSelectedRowId('')
    setSelectedVarietyId('')
    setSelectedPartie('')
    prevAutoVarietyRef.current = null
    prevAutoPartRef.current = null
  }

  function handleRowChange(rowId: string) {
    setSelectedRowId(rowId)
    setSelectedVarietyId('')
    setSelectedPartie('')
    prevAutoVarietyRef.current = null
    prevAutoPartRef.current = null
  }

  function handleVarietyChange(varietyId: string) {
    setSelectedVarietyId(varietyId)
    setSelectedPartie('')
    prevAutoPartRef.current = null
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('type_cueillette', typeCueillette)
    fd.set('variety_id', selectedVarietyId)
    fd.set('partie_plante', selectedPartie)

    if (typeCueillette === 'parcelle') {
      fd.set('row_id', selectedRowId)
      fd.delete('lieu_sauvage')
    } else {
      fd.delete('row_id')
    }

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

  // Source du select variete en mode parcelle
  const hasRowVarieties = typeCueillette === 'parcelle' && rowVarieties.length > 0
  const hasMultipleVarieties = typeCueillette === 'parcelle' && rowVarieties.length > 1
  const hasNoVarieties = typeCueillette === 'parcelle' && !loadingVarieties && selectedRowId && rowVarieties.length === 0
  const varietyOptions = hasRowVarieties ? rowVarieties : catalogVarieties

  // Source du select partie_plante
  const partieOptions: PartiePlante[] = parts.length > 0 ? parts : [...PARTIES_PLANTE]

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
        aria-label={isEdit ? 'Modifier la cueillette' : 'Nouvelle cueillette'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '500px',
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
            {isEdit ? 'Modifier la cueillette' : 'Nouvelle cueillette'}
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

            {/* Type de cueillette */}
            <Field label="Type de cueillette" required>
              <div className="flex gap-2">
                <ToggleBtn
                  ref={firstFieldRef}
                  active={typeCueillette === 'parcelle'}
                  onClick={() => handleTypeChange('parcelle')}
                  disabled={isPending || isEdit}
                >
                  🌿 Parcelle
                </ToggleBtn>
                <ToggleBtn
                  active={typeCueillette === 'sauvage'}
                  onClick={() => handleTypeChange('sauvage')}
                  disabled={isPending || isEdit}
                >
                  🌾 Sauvage
                </ToggleBtn>
              </div>
              {isEdit && (
                <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
                  Le type ne peut pas etre modifie en edition.
                </p>
              )}
            </Field>

            {/* ---- Champs conditionnels : Parcelle ---- */}
            {typeCueillette === 'parcelle' && (
              <>
                {/* Rang */}
                <Field label="Rang" required>
                  <select
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

                {/* Indicateur chargement varietes */}
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
                    Ce rang a {rowVarieties.length} varietes actives. Selectionnez celle concernee.
                  </WarningBanner>
                )}
              </>
            )}

            {/* ---- Champs conditionnels : Sauvage ---- */}
            {typeCueillette === 'sauvage' && (
              <Field label="Lieu de cueillette" required>
                <input
                  name="lieu_sauvage"
                  type="text"
                  required
                  list="lieux-sauvages-list"
                  defaultValue={harvest?.lieu_sauvage ?? ''}
                  disabled={isPending}
                  placeholder="Nom du lieu (foret, bord de route…)"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <datalist id="lieux-sauvages-list">
                  {lieuxSauvages.map(l => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
            )}

            {/* Variete */}
            <Field label="Variete" required>
              <select
                name="variety_id"
                required
                value={selectedVarietyId}
                onChange={e => handleVarietyChange(e.target.value)}
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

            {/* Partie plante */}
            <Field label="Partie de plante" required>
              {loadingParts && selectedVarietyId && (
                <div className="text-xs mb-1" style={{ color: '#9CA89D' }}>
                  Chargement des parties…
                </div>
              )}
              <select
                name="partie_plante"
                required
                value={selectedPartie}
                onChange={e => setSelectedPartie(e.target.value)}
                disabled={isPending || loadingParts}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Selectionner une partie</option>
                {partieOptions.map(p => (
                  <option key={p} value={p}>
                    {PARTIE_PLANTE_LABELS[p]}
                  </option>
                ))}
              </select>
              {autoPart && selectedPartie === autoPart && (
                <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                  Partie auto-selectionnee (seule partie pour cette variete)
                </p>
              )}
            </Field>

            {/* Date */}
            <Field label="Date" required>
              <input
                name="date"
                type="date"
                required
                defaultValue={harvest?.date ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Grille 2 colonnes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Poids */}
              <Field label="Poids (g)" required>
                <input
                  name="poids_g"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  defaultValue={harvest?.poids_g ?? ''}
                  disabled={isPending}
                  placeholder="en grammes"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              {/* Temps */}
              <Field label="Temps (min)">
                <input
                  name="temps_min"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={harvest?.temps_min ?? ''}
                  disabled={isPending}
                  placeholder="en minutes"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={harvest?.commentaire ?? ''}
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
                : isEdit ? 'Enregistrer' : 'Creer la cueillette'}
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

/** Bouton toggle pour le choix de type de cueillette */
import { forwardRef } from 'react'

const ToggleBtn = forwardRef<
  HTMLButtonElement,
  {
    active: boolean
    onClick: () => void
    disabled: boolean
    children: React.ReactNode
  }
>(function ToggleBtn({ active, onClick, disabled, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#6B7B6C',
        border: active ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
})

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
