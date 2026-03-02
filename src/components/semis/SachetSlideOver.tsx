'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { SeedLotWithVariety, Variety, ActionResult } from '@/lib/types'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'

type Props = {
  open:      boolean
  seedLot:   SeedLotWithVariety | null  // null = création
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
  onClose:   () => void
  onSubmit:  (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function SachetSlideOver({ open, seedLot, varieties: initialVarieties, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  /* Liste locale des variétés — s'enrichit si on crée via QuickAddVariety */
  const [varieties, setVarieties] = useState(initialVarieties)
  /* Variété sélectionnée dans le select */
  const [selectedVarietyId, setSelectedVarietyId] = useState(seedLot?.variety_id ?? '')

  /* Resync si les variétés initiales changent (re-render parent) */
  useEffect(() => {
    setVarieties(initialVarieties)
  }, [initialVarieties])

  /* Resync si on change de sachet (nouveau slide-over via key prop) */
  useEffect(() => {
    setSelectedVarietyId(seedLot?.variety_id ?? '')
    setError(null)
  }, [seedLot])

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

  /** Appelé quand une variété est créée via QuickAddVariety */
  function handleVarietyCreated(variety: Variety) {
    setVarieties(prev => {
      // Évite les doublons si la variété existe déjà dans la liste
      if (prev.some(v => v.id === variety.id)) return prev
      return [...prev, { id: variety.id, nom_vernaculaire: variety.nom_vernaculaire, nom_latin: variety.nom_latin }]
        .sort((a, b) => a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr'))
    })
    setSelectedVarietyId(variety.id)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    // S'assurer que la valeur du select contrôlé est bien dans le FormData
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

  const isEdit = seedLot !== null

  return (
    <>
      {/* ---- Overlay ---- */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position:        'fixed', inset: 0, zIndex: 40,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter:  'blur(2px)',
          opacity:         open ? 1 : 0,
          pointerEvents:   open ? 'auto' : 'none',
          transition:      'opacity 0.25s ease',
        }}
      />

      {/* ---- Panneau ---- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier le sachet' : 'Nouveau sachet de graines'}
        style={{
          position:        'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width:           '100%', maxWidth: '500px',
          backgroundColor: '#FAF5E9',
          boxShadow:       '-4px 0 24px rgba(0,0,0,0.12)',
          display:         'flex', flexDirection: 'column',
          transform:       open ? 'translateX(0)' : 'translateX(100%)',
          transition:      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tête */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
              {isEdit ? 'Modifier le sachet' : 'Nouveau sachet de graines'}
            </h2>
            {/* Numéro de lot en lecture seule en mode édition */}
            {isEdit && (
              <span
                className="mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: '#E8F0E9', color: '#3A5A40' }}
              >
                {seedLot.lot_interne}
              </span>
            )}
          </div>
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

            {/* Variété */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
                  Variété <span style={{ color: '#BC6C25' }}>*</span>
                </label>
                {/* QuickAddVariety reçoit les variétés complètes — on reconstitue Variety[] minimale */}
                <QuickAddVariety
                  existingVarieties={varieties as Variety[]}
                  onCreated={handleVarietyCreated}
                />
              </div>
              <select
                ref={firstFieldRef}
                name="variety_id"
                required
                value={selectedVarietyId}
                onChange={e => setSelectedVarietyId(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner une variété</option>
                {varieties.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}
                    {v.nom_latin ? ` — ${v.nom_latin}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Fournisseur */}
            <Field label="Fournisseur">
              <input
                name="fournisseur"
                type="text"
                defaultValue={seedLot?.fournisseur ?? ''}
                disabled={isPending}
                placeholder="ex : Semences du Puy"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Date d'achat + Date facture — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date d'achat" required>
                <input
                  name="date_achat"
                  type="date"
                  required
                  defaultValue={seedLot?.date_achat ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Date facture">
                <input
                  name="date_facture"
                  type="date"
                  defaultValue={seedLot?.date_facture ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* N° facture + N° lot fournisseur — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="N° facture">
                <input
                  name="numero_facture"
                  type="text"
                  defaultValue={seedLot?.numero_facture ?? ''}
                  disabled={isPending}
                  placeholder="ex : FAC-2025-042"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="N° lot fournisseur">
                <input
                  name="numero_lot_fournisseur"
                  type="text"
                  defaultValue={seedLot?.numero_lot_fournisseur ?? ''}
                  disabled={isPending}
                  placeholder="ex : LAV-2025-A"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Poids sachet + Certification AB — en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Poids sachet (g)">
                <input
                  name="poids_sachet_g"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={seedLot?.poids_sachet_g ?? ''}
                  disabled={isPending}
                  placeholder="ex : 2.5"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Certification">
                <label
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '8px',
                    padding:         '8px 12px',
                    borderRadius:    '8px',
                    border:          '1px solid #D8E0D9',
                    backgroundColor: '#F9F8F6',
                    cursor:          isPending ? 'not-allowed' : 'pointer',
                    fontSize:        '14px',
                    color:           '#2C3E2D',
                    userSelect:      'none',
                  }}
                >
                  <input
                    type="checkbox"
                    name="certif_ab"
                    defaultChecked={seedLot?.certif_ab ?? false}
                    disabled={isPending}
                    style={{ accentColor: '#3A5A40', width: '16px', height: '16px' }}
                  />
                  <span>
                    Agriculture biologique{' '}
                    <span
                      className="inline-block px-1.5 py-0 rounded-full text-xs font-semibold ml-0.5"
                      style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                    >
                      AB
                    </span>
                  </span>
                </label>
              </Field>
            </div>

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={seedLot?.commentaire ?? ''}
                disabled={isPending}
                placeholder="Observations, conditions de stockage…"
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
                  color:           '#BC6C25',
                  border:          '1px solid #DDA15E44',
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
                color:           '#F9F8F6',
                opacity:         isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer' : 'Créer le sachet'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Helpers de style ---- */
const inputStyle: React.CSSProperties = {
  width:           '100%',
  padding:         '8px 12px',
  fontSize:        '14px',
  borderRadius:    '8px',
  border:          '1px solid #D8E0D9',
  backgroundColor: '#F9F8F6',
  color:           '#2C3E2D',
  outline:         'none',
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
  label:     string
  required?: boolean
  children:  React.ReactNode
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
