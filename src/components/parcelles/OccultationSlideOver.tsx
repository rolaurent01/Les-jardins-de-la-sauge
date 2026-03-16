'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Field } from '@/components/ui/Field'
import type { OccultationWithRelations, RowWithParcel, MethodeOccultation, ActionResult } from '@/lib/types'
import { groupRowsByParcel } from '@/lib/utils/parcels'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'

type Props = {
  open: boolean
  occultation: OccultationWithRelations | null
  rows: RowWithParcel[]
  engraisVertNoms: string[]
  certifBio?: boolean
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const METHODES: { value: MethodeOccultation; label: string }[] = [
  { value: 'paille', label: '🟡 Paille' },
  { value: 'foin', label: '🟤 Foin' },
  { value: 'bache', label: '⬜ Bache' },
  { value: 'engrais_vert', label: '🟢 Engrais vert' },
]

export default function OccultationSlideOver({
  open,
  occultation,
  rows,
  engraisVertNoms,
  certifBio = false,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const isEdit = occultation !== null

  // ---- State du formulaire ----
  const [selectedRowId, setSelectedRowId] = useState(occultation?.row_id ?? '')
  const [methode, setMethode] = useState<MethodeOccultation>(occultation?.methode ?? 'paille')

  // Resync a l'ouverture/changement d'occultation
  useEffect(() => {
    setSelectedRowId(occultation?.row_id ?? '')
    setMethode(occultation?.methode ?? 'paille')
    setError(null)
  }, [occultation])

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('row_id', selectedRowId)
    fd.set('methode', methode)

    // Nettoyer les champs des methodes non selectionnees
    if (methode !== 'paille' && methode !== 'foin') {
      fd.delete('fournisseur')
    }
    if (methode !== 'paille') {
      fd.delete('attestation')
    }
    if (methode !== 'engrais_vert') {
      fd.delete('engrais_vert_nom')
      fd.delete('engrais_vert_fournisseur')
      fd.delete('engrais_vert_facture')
      fd.delete('engrais_vert_certif_ab')
    }
    if (methode !== 'bache') {
      fd.delete('temps_retrait_min')
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
        aria-label={isEdit ? 'Modifier l\'occultation' : 'Nouvelle occultation'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '520px',
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
            {isEdit ? 'Modifier l\'occultation' : 'Nouvelle occultation'}
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
                onChange={e => setSelectedRowId(e.target.value)}
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

            {/* Methode — 4 boutons */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
                Methode <span style={{ color: '#BC6C25' }}>*</span>
              </label>
              <div
                className="flex rounded-lg overflow-hidden border"
                style={{ borderColor: '#D8E0D9' }}
              >
                {METHODES.map(m => (
                  <MethodeBtn
                    key={m.value}
                    active={methode === m.value}
                    onClick={() => setMethode(m.value)}
                    disabled={isPending}
                  >
                    {m.label}
                  </MethodeBtn>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date debut" required>
                <input
                  name="date_debut"
                  type="date"
                  required
                  defaultValue={occultation?.date_debut ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
              <Field label="Date fin">
                <input
                  name="date_fin"
                  type="date"
                  defaultValue={occultation?.date_fin ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
                  Vide = occultation en cours
                </p>
              </Field>
            </div>

            {/* ===== Champs specifiques Paille ===== */}
            {methode === 'paille' && (
              <>
                <Separator label="Paille" />
                <Field label="Fournisseur" required>
                  <input
                    name="fournisseur"
                    type="text"
                    required
                    defaultValue={occultation?.methode === 'paille' ? occultation.fournisseur ?? '' : ''}
                    disabled={isPending}
                    placeholder="Provenance de la paille"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
                <Field label="Attestation">
                  <input
                    name="attestation"
                    type="text"
                    defaultValue={occultation?.methode === 'paille' ? occultation.attestation ?? '' : ''}
                    disabled={isPending}
                    placeholder="Certification (optionnel)"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
              </>
            )}

            {/* ===== Champs specifiques Foin ===== */}
            {methode === 'foin' && (
              <>
                <Separator label="Foin" />
                <Field label="Fournisseur" required>
                  <input
                    name="fournisseur"
                    type="text"
                    required
                    defaultValue={occultation?.methode === 'foin' ? occultation.fournisseur ?? '' : ''}
                    disabled={isPending}
                    placeholder="Provenance du foin"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
              </>
            )}

            {/* ===== Champs specifiques Bache ===== */}
            {methode === 'bache' && (
              <>
                <Separator label="Bache" />
                <Field label="Temps de retrait (min)">
                  <input
                    name="temps_retrait_min"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={occultation?.methode === 'bache' ? occultation.temps_retrait_min ?? '' : ''}
                    disabled={isPending}
                    placeholder="Temps de demontage"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
              </>
            )}

            {/* ===== Champs specifiques Engrais vert ===== */}
            {methode === 'engrais_vert' && (
              <>
                <Separator label="Engrais vert" />
                <Field label="Nom de l'engrais vert" required>
                  <input
                    name="engrais_vert_nom"
                    type="text"
                    required
                    list="engrais-verts"
                    defaultValue={occultation?.methode === 'engrais_vert' ? occultation.engrais_vert_nom ?? '' : ''}
                    disabled={isPending}
                    placeholder="ex : Moutarde blanche, Seigle…"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  <datalist id="engrais-verts">
                    {engraisVertNoms.map(n => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Fournisseur" required>
                  <input
                    name="engrais_vert_fournisseur"
                    type="text"
                    required
                    defaultValue={occultation?.methode === 'engrais_vert' ? occultation.engrais_vert_fournisseur ?? '' : ''}
                    disabled={isPending}
                    placeholder="Provenance des graines"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="N° facture">
                    <input
                      name="engrais_vert_facture"
                      type="text"
                      defaultValue={occultation?.methode === 'engrais_vert' ? occultation.engrais_vert_facture ?? '' : ''}
                      disabled={isPending}
                      placeholder="Optionnel"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Certifie AB">
                    <div className="flex items-center h-[38px]">
                      <input
                        name="engrais_vert_certif_ab"
                        type="checkbox"
                        defaultChecked={occultation?.methode === 'engrais_vert' ? occultation.engrais_vert_certif_ab : certifBio}
                        disabled={isPending}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span className="ml-2 text-sm" style={{ color: '#2C3E2D' }}>
                        Agriculture biologique
                      </span>
                    </div>
                    {!occultation && certifBio && (
                      <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
                        Pré-coché (ferme bio)
                      </p>
                    )}
                  </Field>
                </div>
              </>
            )}

            {/* ===== Champs communs fin ===== */}
            <Separator label="Commun" />

            <Field label="Temps de mise en place (min)">
              <input
                name="temps_min"
                type="number"
                min="1"
                step="1"
                defaultValue={occultation?.temps_min ?? ''}
                disabled={isPending}
                placeholder="en minutes"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={occultation?.commentaire ?? ''}
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
                : isEdit ? 'Enregistrer' : 'Creer l\'occultation'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Sous-composants utilitaires ---- */

function MethodeBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 px-2 py-2.5 text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#9CA89D',
      }}
    >
      {children}
    </button>
  )
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA89D' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: '#D8E0D9' }} />
    </div>
  )
}



