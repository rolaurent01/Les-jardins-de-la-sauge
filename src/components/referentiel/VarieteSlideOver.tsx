'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { Variety, ActionResult, PartiePlante } from '@/lib/types'
import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'

/* Familles prédéfinies issues du context.md §5 */
const FAMILLES = [
  'Lamiacées', 'Astéracées', 'Malvacées', 'Verbénacées',
  'Papavéracées', 'Apiacées', 'Scrophulariacées', 'Valérianacées',
  'Rosacées', 'Boraginacées',
]

const TYPE_CYCLE_OPTIONS = [
  { value: 'annuelle',    label: 'Annuelle' },
  { value: 'bisannuelle', label: 'Bisannuelle' },
  { value: 'perenne',     label: 'Pérenne' },
  { value: 'vivace',      label: 'Vivace' },
]

type Props = {
  open: boolean
  variety: Variety | null            // null = création
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function VarieteSlideOver({ open, variety, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  /* Parties utilisées sélectionnées — initialisé depuis la variété en édition */
  const [selectedParties, setSelectedParties] = useState<PartiePlante[]>(
    variety?.parties_utilisees ?? ['plante_entiere']
  )

  /* Resync si on change de variété (nouveau slide-over via key prop) */
  useEffect(() => {
    setSelectedParties(variety?.parties_utilisees ?? ['plante_entiere'])
  }, [variety])

  function togglePartie(partie: PartiePlante) {
    setSelectedParties(prev =>
      prev.includes(partie)
        ? prev.filter(p => p !== partie)
        : [...prev, partie]
    )
  }

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

    if (selectedParties.length === 0) {
      setError('Sélectionnez au moins une partie utilisée.')
      return
    }

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

  const isEdit = variety !== null

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
        aria-label={isEdit ? 'Modifier la variété' : 'Nouvelle variété'}
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
            {isEdit ? `Modifier — ${variety.nom_vernaculaire}` : 'Nouvelle variété'}
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

            {/* Nom vernaculaire */}
            <Field label="Nom vernaculaire" required>
              <input
                ref={firstFieldRef}
                name="nom_vernaculaire"
                type="text"
                required
                defaultValue={variety?.nom_vernaculaire ?? ''}
                disabled={isPending}
                placeholder="ex : Lavande vraie"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Nom latin */}
            <Field label="Nom latin">
              <input
                name="nom_latin"
                type="text"
                defaultValue={variety?.nom_latin ?? ''}
                disabled={isPending}
                placeholder="ex : Lavandula angustifolia"
                style={{ ...inputStyle, fontStyle: 'italic' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Famille */}
            <Field label="Famille">
              <input
                name="famille"
                type="text"
                list="familles-list"
                defaultValue={variety?.famille ?? ''}
                disabled={isPending}
                placeholder="ex : Lamiacées"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <datalist id="familles-list">
                {FAMILLES.map(f => <option key={f} value={f} />)}
              </datalist>
            </Field>

            {/* Type de cycle */}
            <Field label="Type de cycle">
              <select
                name="type_cycle"
                defaultValue={variety?.type_cycle ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Non renseigné</option>
                {TYPE_CYCLE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* Parties utilisées */}
            <Field label="Parties utilisées" required hint="Au moins une">
              <div className="flex flex-wrap gap-2 mt-0.5">
                {PARTIES_PLANTE.map(partie => {
                  const checked = selectedParties.includes(partie)
                  return (
                    <label
                      key={partie}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        borderRadius: '20px',
                        border: `1px solid ${checked ? '#3A5A40' : '#D8E0D9'}`,
                        backgroundColor: checked ? '#3A5A4014' : '#F9F8F6',
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        color: checked ? '#2C3E2D' : '#6B7B6C',
                        userSelect: 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="parties_utilisees"
                        value={partie}
                        checked={checked}
                        disabled={isPending}
                        onChange={() => togglePartie(partie)}
                        style={{ accentColor: '#3A5A40' }}
                      />
                      {PARTIE_PLANTE_LABELS[partie]}
                    </label>
                  )
                })}
              </div>
              {selectedParties.length === 0 && (
                <p className="mt-1.5 text-xs" style={{ color: '#BC6C25' }}>
                  Sélectionnez au moins une partie.
                </p>
              )}
            </Field>

            {/* Durée péremption + Seuil alerte — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Péremption (mois)">
                <input
                  name="duree_peremption_mois"
                  type="number"
                  min="1"
                  max="120"
                  defaultValue={variety?.duree_peremption_mois ?? 24}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Seuil alerte (g)" hint="Laissez vide = pas d'alerte">
                <input
                  name="seuil_alerte_g"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={variety?.seuil_alerte_g ?? ''}
                  disabled={isPending}
                  placeholder="ex : 100"
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
                defaultValue={variety?.notes ?? ''}
                disabled={isPending}
                placeholder="Observations, particularités de culture, sources…"
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '80px',
                }}
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
                : isEdit ? 'Enregistrer' : 'Créer la variété'}
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
      <label
        className="block text-sm font-medium mb-1.5"
        style={{ color: '#2C3E2D' }}
      >
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
