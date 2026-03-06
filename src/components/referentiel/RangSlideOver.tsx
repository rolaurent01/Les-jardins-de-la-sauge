'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { ParcelWithSite, RowWithParcel, ActionResult } from '@/lib/types'

type Props = {
  open: boolean
  row: RowWithParcel | null       // null = création
  parcels: ParcelWithSite[]       // parcelles actives pour le select
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function RangSlideOver({ open, row, parcels, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

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
    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  /* Parcelles groupées par site pour le select */
  const siteGroups = parcels.reduce<Record<string, { siteName: string; parcels: ParcelWithSite[] }>>(
    (acc, p) => {
      const siteId = p.sites?.id ?? 'sans-site'
      const siteName = p.sites?.nom ?? 'Sans site'
      if (!acc[siteId]) acc[siteId] = { siteName, parcels: [] }
      acc[siteId].parcels.push(p)
      return acc
    },
    {}
  )

  const isEdit = row !== null

  return (
    <>
      {/* Overlay */}
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

      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier le rang' : 'Nouveau rang'}
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
            {isEdit
              ? `Modifier — Rang ${row.numero} (${row.parcels?.code ?? '?'})`
              : 'Nouveau rang'}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg"
            style={{ color: '#9CA89D' }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-6 py-5 space-y-5 flex-1">

            {/* Parcelle */}
            <Field label="Parcelle" required>
              <select
                ref={firstFieldRef}
                name="parcel_id"
                required
                defaultValue={row?.parcel_id ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner une parcelle</option>
                {Object.values(siteGroups).map(({ siteName, parcels: siteParcels }) => (
                  <optgroup key={siteName} label={siteName}>
                    {siteParcels.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.nom}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* Numéro + Ancien numéro — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Numéro" required>
                <input
                  name="numero"
                  type="text"
                  required
                  defaultValue={row?.numero ?? ''}
                  disabled={isPending}
                  placeholder="ex : 01, A, R3…"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Ancien numéro" hint="Référence historique">
                <input
                  name="ancien_numero"
                  type="text"
                  defaultValue={row?.ancien_numero ?? ''}
                  disabled={isPending}
                  placeholder="ex : R1"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Longueur + Position — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Longueur (m)" hint="Optionnel">
                <input
                  name="longueur_m"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={row?.longueur_m ?? ''}
                  disabled={isPending}
                  placeholder="ex : 25.5"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Ordre d'affichage" hint="Optionnel">
                <input
                  name="position_ordre"
                  type="number"
                  min="1"
                  defaultValue={row?.position_ordre ?? ''}
                  disabled={isPending}
                  placeholder="ex : 1"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                name="notes"
                rows={3}
                defaultValue={row?.notes ?? ''}
                disabled={isPending}
                placeholder="Observations, variétés plantées, historique…"
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

          {/* Pied */}
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
              className="px-5 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer' : 'Créer le rang'}
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
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
        {label}
        {required && <span style={{ color: '#BC6C25' }}> *</span>}
        {hint && (
          <span className="ml-1 font-normal text-xs" style={{ color: '#9CA89D' }}>
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
