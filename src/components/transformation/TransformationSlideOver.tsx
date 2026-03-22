'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Field } from '@/components/ui/Field'
import type { Variety, PartiePlante, ActionResult, TransformationType } from '@/lib/types'
import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'
import { useVarietyParts } from '@/hooks/useVarietyParts'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'
import type { TransformationModuleConfig, TransformationItem } from './types'
import { ETAT_PLANTE_LABELS } from './types'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import DateYearWarning from '@/components/shared/DateYearWarning'

type Props = {
  config: TransformationModuleConfig
  open: boolean
  onClose: () => void
  type: TransformationType
  item: TransformationItem | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function TransformationSlideOver({
  config,
  open,
  onClose,
  type,
  item,
  varieties: catalogVarieties,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = item !== null

  // ---- State du formulaire ----
  const [selectedVarietyId, setSelectedVarietyId] = useState(item?.variety_id ?? '')
  const [selectedPartie, setSelectedPartie] = useState<string>(item?.partie_plante ?? '')
  const [selectedEtat, setSelectedEtat] = useState<string>(item?.etat_plante ?? '')
  const [allVarieties, setAllVarieties] = useState(catalogVarieties)
  const [date, setDate] = useState(item?.date ?? '')

  // ---- Hook logique adaptative partie_plante ----
  const { parts, loading: loadingParts, autoPart } = useVarietyParts(
    selectedVarietyId || null,
  )

  // Auto-remplissage partie_plante quand le hook retourne 1 seule partie
  const prevAutoPartRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoPart && autoPart !== prevAutoPartRef.current) {
      setSelectedPartie(autoPart)
      prevAutoPartRef.current = autoPart
    }
  }, [autoPart])

  // Resync a l'ouverture/changement d'item
  useEffect(() => {
    setSelectedVarietyId(item?.variety_id ?? '')
    setSelectedPartie(item?.partie_plante ?? '')
    setSelectedEtat(item?.etat_plante ?? '')
    setDate(item?.date ?? '')
    setError(null)
    prevAutoPartRef.current = null
    setAllVarieties(catalogVarieties)
  }, [item, catalogVarieties])

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  function handleVarietyChange(varietyId: string) {
    setSelectedVarietyId(varietyId)
    setSelectedPartie('')
    prevAutoPartRef.current = null
  }

  // Source du select partie_plante
  const partieOptions: PartiePlante[] = parts.length > 0 ? parts : [...PARTIES_PLANTE]

  // Etats plante disponibles selon le type (entree/sortie)
  const etatOptions = type === 'entree' ? config.etatsEntree : config.etatsSortie
  const hasEtatSelector = etatOptions !== null

  // Label du titre
  const titleLabel = isEdit
    ? `Modifier ${config.titreSingulier}`
    : `Nouvelle ${type === 'entree' ? 'entree' : 'sortie'} de ${config.titreSingulier}`

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    fd.set('variety_id', selectedVarietyId)
    fd.set('partie_plante', selectedPartie)

    if (hasEtatSelector) {
      fd.set('etat_plante', selectedEtat)
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

  // Couleur du bouton submit selon le type
  const submitBg = type === 'entree' ? 'var(--color-primary)' : '#DDA15E'

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
        aria-label={titleLabel}
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
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
              {titleLabel}
            </h2>
            {isEdit && (
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: type === 'entree' ? '#DCFCE7' : '#FEF3C7',
                  color: type === 'entree' ? '#166534' : '#92400E',
                }}
              >
                {type === 'entree' ? '🟢 Entree' : '🔴 Sortie'}
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

            {/* Type (hidden) */}
            <input type="hidden" name="type" value={type} />

            {/* Variete */}
            <Field label="Variete" required>
              <div className="flex items-center gap-2 mb-1.5">
                <QuickAddVariety
                  existingVarieties={allVarieties as Variety[]}
                  onCreated={(newVar) => {
                    setAllVarieties(prev => [...prev, { id: newVar.id, nom_vernaculaire: newVar.nom_vernaculaire }])
                    setSelectedVarietyId(newVar.id)
                    setSelectedPartie('')
                    prevAutoPartRef.current = null
                  }}
                />
              </div>
              <select
                name="variety_id"
                required
                value={selectedVarietyId}
                onChange={e => handleVarietyChange(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Selectionner une variete</option>
                {allVarieties.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}
                  </option>
                ))}
              </select>
            </Field>

            {/* Partie plante */}
            <Field label="Partie de plante" required>
              {loadingParts && selectedVarietyId && (
                <div className="text-xs mb-1" style={{ color: '#9CA89D' }}>
                  Chargement des parties…
                </div>
              )}
              {autoPart && selectedPartie === autoPart ? (
                <>
                  <input type="hidden" name="partie_plante" value={autoPart} />
                  <div
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: '#F9F8F6', border: '1px solid #D8E0D9', color: '#2C3E2D' }}
                  >
                    {PARTIE_PLANTE_LABELS[autoPart as PartiePlante] ?? autoPart}
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                    Partie auto-selectionnee (seule partie pour cette variete)
                  </p>
                </>
              ) : (
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
              )}
              <p className="text-xs mt-1.5 px-1" style={{ color: '#9CA89D' }}>
                Partie heritee dans toute la chaine de transformation
              </p>
            </Field>

            {/* Etat plante (sechage et triage uniquement) */}
            {hasEtatSelector && (
              <Field label="Etat de la plante" required>
                <select
                  name="etat_plante"
                  required
                  value={selectedEtat}
                  onChange={e => setSelectedEtat(e.target.value)}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">— Selectionner un etat</option>
                  {etatOptions!.map(etat => (
                    <option key={etat} value={etat}>
                      {ETAT_PLANTE_LABELS[etat] ?? etat}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* Date */}
            <Field label="Date" required>
              <input
                name="date"
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <DateYearWarning date={date} />
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
                  defaultValue={item?.poids_g ?? ''}
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
                  defaultValue={item?.temps_min ?? ''}
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
                defaultValue={item?.commentaire ?? ''}
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
                backgroundColor: submitBg,
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? 'Enregistrement…'
                : type === 'entree'
                  ? "Enregistrer l'entree"
                  : 'Enregistrer la sortie'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}



