'use client'

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { Field } from '@/components/ui/Field'
import type { UprootingWithRelations, RowWithParcel, RowPlantingInfo, Variety, ActionResult } from '@/lib/types'
import { groupRowsByParcel } from '@/lib/utils/parcels'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import DateYearWarning from '@/components/shared/DateYearWarning'

type Props = {
  open: boolean
  uprooting: UprootingWithRelations | null
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  rowPlantings: RowPlantingInfo[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function ArrachageSlideOver({
  open,
  uprooting,
  rows,
  varieties: _catalogVarieties,
  rowPlantings,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const isEdit = uprooting !== null

  // ---- State du formulaire ----
  const [selectedRowId, setSelectedRowId] = useState(uprooting?.row_id ?? '')
  const [selectedVarietyId, setSelectedVarietyId] = useState(uprooting?.variety_id ?? '')
  const [date, setDate] = useState(uprooting?.date ?? '')

  // ---- Index des varietes actives par rang ----
  const varietiesByRow = useMemo(() => {
    const map = new Map<string, { id: string; nom_vernaculaire: string }[]>()
    for (const p of rowPlantings) {
      const list = map.get(p.row_id) ?? []
      if (!list.some(v => v.id === p.variety_id)) {
        list.push({ id: p.variety_id, nom_vernaculaire: p.variety_name })
      }
      map.set(p.row_id, list)
    }
    return map
  }, [rowPlantings])

  // ---- Label enrichi pour les options de rang ----
  const rowLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      const varieties = varietiesByRow.get(row.id)
      const suffix = varieties?.length
        ? ` (${varieties.map(v => v.nom_vernaculaire).join(', ')})`
        : ' (vide)'
      map.set(row.id, `Rang ${row.numero}${suffix}`)
    }
    return map
  }, [rows, varietiesByRow])

  // ---- Varietes du rang selectionne ----
  const rowVarieties = selectedRowId ? (varietiesByRow.get(selectedRowId) ?? []) : []
  const hasRowVarieties = rowVarieties.length > 0
  const hasMultipleVarieties = rowVarieties.length > 1
  const hasNoVarieties = selectedRowId && rowVarieties.length === 0
  const autoVariety = rowVarieties.length === 1 ? rowVarieties[0] : null

  // Auto-remplissage variete quand 1 seule variete active sur le rang
  const prevAutoRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoVariety && autoVariety.id !== prevAutoRef.current) {
      setSelectedVarietyId(autoVariety.id)
      prevAutoRef.current = autoVariety.id
    }
  }, [autoVariety])

  // Resync a l'ouverture/changement de uprooting
  useEffect(() => {
    setSelectedRowId(uprooting?.row_id ?? '')
    setSelectedVarietyId(uprooting?.variety_id ?? '')
    setDate(uprooting?.date ?? '')
    setError(null)
    prevAutoRef.current = null
  }, [uprooting])

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
    // variety_id vide = tout le rang (null cote serveur)
    fd.set('variety_id', selectedVarietyId === '__all__' ? '' : selectedVarietyId)

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

  // Resume informatif des plantations actives
  const plantingSummary = hasRowVarieties
    ? `Ce rang a ${rowVarieties.length} plantation${rowVarieties.length > 1 ? 's' : ''} active${rowVarieties.length > 1 ? 's' : ''} : ${rowVarieties.map(v => v.nom_vernaculaire).join(', ')}. L'arrachage passera la plantation selectionnee en "inactive".`
    : null

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
        aria-label={isEdit ? 'Modifier l\'arrachage' : 'Nouvel arrachage'}
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
            {isEdit ? 'Modifier l\'arrachage' : 'Nouvel arrachage'}
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

            {/* Rang — labels enrichis avec varietes */}
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
                        {rowLabel.get(row.id) ?? `Rang ${row.numero}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* Avertissement : aucune variete active */}
            {hasNoVarieties && (
              <WarningBanner>
                Aucune variete active sur ce rang — rien a arracher.
              </WarningBanner>
            )}

            {/* Resume informatif des plantations actives */}
            {plantingSummary && (
              <div
                className="text-xs px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #3B82F644' }}
              >
                {plantingSummary}
              </div>
            )}

            {/* Variete — auto-remplie si 1 seule, select si plusieurs */}
            {hasRowVarieties && (
              autoVariety ? (
                <Field label="Variete">
                  <div
                    className="px-3 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: '#F5F2ED', color: '#2C3E2D', border: '1px solid #D8E0D9' }}
                  >
                    {autoVariety.nom_vernaculaire}
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                    Seule variete active sur ce rang
                  </p>
                </Field>
              ) : (
                <Field label="Variete">
                  <select
                    name="variety_id"
                    value={selectedVarietyId}
                    onChange={e => setSelectedVarietyId(e.target.value)}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    <option value="__all__">Tout le rang</option>
                    {rowVarieties.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.nom_vernaculaire}
                      </option>
                    ))}
                  </select>
                </Field>
              )
            )}

            {/* Date */}
            <Field label="Date" required>
              <input
                name="date"
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <DateYearWarning date={date} />
            </Field>

            {/* Temps */}
            <Field label="Temps (min)">
              <input
                name="temps_min"
                type="number"
                min="1"
                step="1"
                defaultValue={uprooting?.temps_min ?? ''}
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
                defaultValue={uprooting?.commentaire ?? ''}
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
              disabled={isPending || (!!hasNoVarieties)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#F9F8F6',
                opacity: isPending || hasNoVarieties ? 0.6 : 1,
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



/** Bandeau d'avertissement */
function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs px-3 py-2 rounded-lg"
      style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B44' }}
    >
      {children}
    </div>
  )
}
