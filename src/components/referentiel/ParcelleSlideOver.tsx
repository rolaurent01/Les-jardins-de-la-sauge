'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Field } from '@/components/ui/Field'
import type { Site, ParcelWithSite, ActionResult } from '@/lib/types'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'

/* Orientations prédéfinies */
const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

type Props = {
  open: boolean
  parcel: ParcelWithSite | null   // null = création
  sites: Site[]                   // sites actifs pour le select
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function ParcelleSlideOver({ open, parcel, sites, onClose, onSubmit, onSuccess }: Props) {
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

  const isEdit = parcel !== null

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
        aria-label={isEdit ? 'Modifier la parcelle' : 'Nouvelle parcelle'}
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
            {isEdit ? `Modifier — ${parcel.code} · ${parcel.nom}` : 'Nouvelle parcelle'}
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

            {/* Site */}
            <Field label="Site" required>
              <select
                ref={firstFieldRef}
                name="site_id"
                required
                defaultValue={parcel?.site_id ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner un site</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </Field>

            {/* Nom + Code — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom" required>
                <input
                  name="nom"
                  type="text"
                  required
                  defaultValue={parcel?.nom ?? ''}
                  disabled={isPending}
                  placeholder="ex : Carré A"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Code" required hint="Majuscules">
                <input
                  name="code"
                  type="text"
                  required
                  defaultValue={parcel?.code ?? ''}
                  disabled={isPending}
                  placeholder="ex : CA-01"
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Orientation */}
            <Field label="Orientation">
              <input
                name="orientation"
                type="text"
                list="orientations-list"
                defaultValue={parcel?.orientation ?? ''}
                disabled={isPending}
                placeholder="ex : S, SE…"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <datalist id="orientations-list">
                {ORIENTATIONS.map(o => <option key={o} value={o} />)}
              </datalist>
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                defaultValue={parcel?.description ?? ''}
                disabled={isPending}
                placeholder="Sol, historique, remarques…"
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
                : isEdit ? 'Enregistrer' : 'Créer la parcelle'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}



