'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { Site, ActionResult } from '@/lib/types'

type Props = {
  open: boolean
  site: Site | null        // null = création
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function SiteSlideOver({ open, site, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  /* Focus le premier champ à l'ouverture */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  /* Fermeture au clavier Escape */
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

  const isEdit = site !== null

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
        aria-label={isEdit ? 'Modifier le site' : 'Nouveau site'}
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
            {isEdit ? `Modifier — ${site.nom}` : 'Nouveau site'}
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

            {/* Nom */}
            <Field label="Nom du site" required>
              <input
                ref={firstFieldRef}
                name="nom"
                type="text"
                required
                defaultValue={site?.nom ?? ''}
                disabled={isPending}
                placeholder="ex : Jardin principal"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                name="description"
                rows={4}
                defaultValue={site?.description ?? ''}
                disabled={isPending}
                placeholder="Localisation, superficie, particularités…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '90px' }}
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
                backgroundColor: '#3A5A40',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer' : 'Créer le site'}
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
