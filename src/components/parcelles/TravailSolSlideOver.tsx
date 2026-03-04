'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { SoilWorkWithRelations, RowWithParcel, ActionResult } from '@/lib/types'

type Props = {
  open:      boolean
  soilWork:  SoilWorkWithRelations | null  // null = création
  rows:      RowWithParcel[]
  onClose:   () => void
  onSubmit:  (fd: FormData) => Promise<ActionResult>
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

export default function TravailSolSlideOver({ open, soilWork, rows, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const [selectedRowId, setSelectedRowId] = useState(soilWork?.row_id ?? '')

  useEffect(() => {
    setSelectedRowId(soilWork?.row_id ?? '')
    setError(null)
  }, [soilWork])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('row_id', selectedRowId)

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const isEdit = soilWork !== null
  const rowGroups = groupRowsByParcel(rows)

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
        aria-label={isEdit ? 'Modifier le travail de sol' : 'Nouveau travail de sol'}
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
        {/* En-tête */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            {isEdit ? 'Modifier le travail de sol' : 'Nouveau travail de sol'}
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

            {/* Rang (select groupé par site → parcelle) */}
            <Field label="Rang" required>
              <select
                ref={firstFieldRef}
                name="row_id"
                required
                value={selectedRowId}
                onChange={e => setSelectedRowId(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner un rang</option>
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

            {/* Date */}
            <Field label="Date" required>
              <input
                name="date"
                type="date"
                required
                defaultValue={soilWork?.date ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Type de travail */}
            <Field label="Type de travail" required>
              <select
                name="type_travail"
                required
                defaultValue={soilWork?.type_travail ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner un type</option>
                <option value="depaillage">Dépaillage</option>
                <option value="motoculteur">Motoculteur</option>
                <option value="amendement">Amendement</option>
                <option value="autre">Autre</option>
              </select>
            </Field>

            {/* Détail */}
            <Field label="Détail">
              <input
                name="detail"
                type="text"
                defaultValue={soilWork?.detail ?? ''}
                disabled={isPending}
                placeholder="Précisions (type d'amendement, etc.)"
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
                defaultValue={soilWork?.temps_min ?? ''}
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
                defaultValue={soilWork?.commentaire ?? ''}
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
                backgroundColor: '#3A5A40',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer' : 'Créer'}
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
  ;(e.target as HTMLElement).style.borderColor = '#3A5A40'
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
