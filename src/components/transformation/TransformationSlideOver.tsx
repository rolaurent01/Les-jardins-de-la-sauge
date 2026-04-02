'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Field } from '@/components/ui/Field'
import type { PartiePlante, ActionResult, TransformationType } from '@/lib/types'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import type { Variety } from '@/lib/types'
import type { TransformationModuleConfig, TransformationItem } from './types'
import { ETAT_PLANTE_LABELS } from './types'
import type { StockEntry } from '@/app/[orgSlug]/(dashboard)/stock/vue-stock/actions'
import type { DryingInProgress } from '@/app/[orgSlug]/(dashboard)/transformation/sechage/actions'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import DateYearWarning from '@/components/shared/DateYearWarning'

/** Clé composite pour identifier une ligne de stock / séchage en cours */
function compositeKey(s: { variety_id: string; partie_plante: string; etat: string }): string {
  return `${s.variety_id}::${s.partie_plante}::${s.etat}`
}

function parseCompositeKey(key: string): { variety_id: string; partie_plante: string; etat: string } | null {
  const parts = key.split('::')
  if (parts.length !== 3) return null
  return { variety_id: parts[0], partie_plante: parts[1], etat: parts[2] }
}

function formatStockG(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

/** Déduit l'état de sortie séchage depuis l'état d'entrée */
const ENTREE_TO_SORTIE_ETAT: Record<string, string> = {
  frais: 'sechee',
  tronconnee: 'tronconnee_sechee',
}

type Props = {
  config: TransformationModuleConfig
  open: boolean
  onClose: () => void
  type: TransformationType
  item: TransformationItem | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  stockEntries?: StockEntry[]
  dryingInProgress?: DryingInProgress[]
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
  stockEntries = [],
  dryingInProgress = [],
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = item !== null
  const isEntree = type === 'entree'
  const isSortieWithDrying = !isEntree && dryingInProgress.length > 0

  // ---- State commune ----
  const [selectedVarietyId, setSelectedVarietyId] = useState(item?.variety_id ?? '')
  const [selectedPartie, setSelectedPartie] = useState<string>(item?.partie_plante ?? '')
  const [selectedEtat, setSelectedEtat] = useState<string>(item?.etat_plante ?? '')
  const [date, setDate] = useState(item?.date ?? '')

  // ---- State sélecteur (entrée stock / sortie séchage en cours) ----
  const [selectedPickerKey, setSelectedPickerKey] = useState('')

  // Map variétés par id
  const varietyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of catalogVarieties) m.set(v.id, v.nom_vernaculaire)
    return m
  }, [catalogVarieties])

  // Stock dispo pour la ligne sélectionnée (entrée)
  const selectedStockDispo = useMemo(() => {
    if (!isEntree || !selectedPickerKey) return null
    const entry = stockEntries.find(s => compositeKey({ variety_id: s.variety_id, partie_plante: s.partie_plante, etat: s.etat_plante }) === selectedPickerKey)
    return entry?.stock_g ?? null
  }, [isEntree, selectedPickerKey, stockEntries])

  // Stock en séchage pour la ligne sélectionnée (sortie)
  const selectedDryingDispo = useMemo(() => {
    if (!isSortieWithDrying || !selectedPickerKey) return null
    const entry = dryingInProgress.find(d => compositeKey({ variety_id: d.variety_id, partie_plante: d.partie_plante, etat: d.etat_plante_entree }) === selectedPickerKey)
    return entry?.en_sechage_g ?? null
  }, [isSortieWithDrying, selectedPickerKey, dryingInProgress])

  // Resync à l'ouverture/changement d'item
  useEffect(() => {
    setSelectedVarietyId(item?.variety_id ?? '')
    setSelectedPartie(item?.partie_plante ?? '')
    setSelectedEtat(item?.etat_plante ?? '')
    setDate(item?.date ?? '')
    setError(null)

    // Pre-fill picker key en mode édition
    if (item && item.etat_plante) {
      if (type === 'entree') {
        setSelectedPickerKey(compositeKey({
          variety_id: item.variety_id,
          partie_plante: item.partie_plante,
          etat: item.etat_plante,
        }))
      } else if (dryingInProgress.length > 0) {
        // Pour sortie séchage, déduire l'état d'entrée depuis l'état de sortie
        const entreeEtat = Object.entries(ENTREE_TO_SORTIE_ETAT).find(([, v]) => v === item.etat_plante)?.[0]
        if (entreeEtat) {
          setSelectedPickerKey(compositeKey({
            variety_id: item.variety_id,
            partie_plante: item.partie_plante,
            etat: entreeEtat,
          }))
        }
      }
    } else {
      setSelectedPickerKey('')
    }
  }, [item, type, dryingInProgress.length])

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  // ---- Handler sélection stock (entrée) ----
  function handleStockSelect(key: string) {
    setSelectedPickerKey(key)
    const parsed = parseCompositeKey(key)
    if (parsed) {
      setSelectedVarietyId(parsed.variety_id)
      setSelectedPartie(parsed.partie_plante)
      setSelectedEtat(parsed.etat)
    } else {
      setSelectedVarietyId('')
      setSelectedPartie('')
      setSelectedEtat('')
    }
  }

  // ---- Handler sélection séchage en cours (sortie) ----
  function handleDryingSelect(key: string) {
    setSelectedPickerKey(key)
    const parsed = parseCompositeKey(key)
    if (parsed) {
      setSelectedVarietyId(parsed.variety_id)
      setSelectedPartie(parsed.partie_plante)
      // Déduire l'état de sortie depuis l'état d'entrée
      setSelectedEtat(ENTREE_TO_SORTIE_ETAT[parsed.etat] ?? parsed.etat)
    } else {
      setSelectedVarietyId('')
      setSelectedPartie('')
      setSelectedEtat('')
    }
  }

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

    if (config.etatsEntree !== null || config.etatsSortie !== null) {
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
                {type === 'entree' ? 'Entree' : 'Sortie'}
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

            {/* ============================================================ */}
            {/* MODE ENTREE : Sélecteur stock source                         */}
            {/* ============================================================ */}
            {isEntree && (
              <>
                <Field label="Stock source" required>
                  <select
                    name="_stock_key"
                    required
                    value={selectedPickerKey}
                    onChange={e => handleStockSelect(e.target.value)}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    <option value="">— Choisir dans le stock</option>
                    {stockEntries.map(s => {
                      const key = compositeKey({ variety_id: s.variety_id, partie_plante: s.partie_plante, etat: s.etat_plante })
                      return (
                        <option key={key} value={key}>
                          {s.nom_vernaculaire} — {PARTIE_PLANTE_LABELS[s.partie_plante as PartiePlante] ?? s.partie_plante} — {ETAT_PLANTE_LABELS[s.etat_plante] ?? s.etat_plante} ({formatStockG(s.stock_g)})
                        </option>
                      )
                    })}
                  </select>
                  {stockEntries.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: '#BC6C25' }}>
                      Aucun stock disponible pour ce type de transformation.
                    </p>
                  )}
                </Field>

                {selectedStockDispo !== null && (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: '#F0F4F0', border: '1px solid #E0E6E0', color: '#6B7B6C' }}
                  >
                    Stock disponible : {formatStockG(selectedStockDispo)}
                  </div>
                )}
              </>
            )}

            {/* ============================================================ */}
            {/* MODE SORTIE + séchage en cours : Sélecteur "en séchage"      */}
            {/* ============================================================ */}
            {isSortieWithDrying && (
              <>
                <Field label="En cours de sechage" required>
                  <select
                    name="_drying_key"
                    required
                    value={selectedPickerKey}
                    onChange={e => handleDryingSelect(e.target.value)}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    <option value="">— Choisir dans le sechoir</option>
                    {dryingInProgress.map(d => {
                      const key = compositeKey({ variety_id: d.variety_id, partie_plante: d.partie_plante, etat: d.etat_plante_entree })
                      return (
                        <option key={key} value={key}>
                          {d.nom_vernaculaire} — {PARTIE_PLANTE_LABELS[d.partie_plante as PartiePlante] ?? d.partie_plante} — {ETAT_PLANTE_LABELS[d.etat_plante_entree] ?? d.etat_plante_entree} ({formatStockG(d.en_sechage_g)})
                        </option>
                      )
                    })}
                  </select>
                  {dryingInProgress.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: '#BC6C25' }}>
                      Rien en cours de sechage.
                    </p>
                  )}
                </Field>

                {selectedDryingDispo !== null && (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ backgroundColor: '#EDE9FE', border: '1px solid #C4B5FD44', color: '#5B21B6' }}
                  >
                    En sechage : {formatStockG(selectedDryingDispo)} — sortira en {ETAT_PLANTE_LABELS[selectedEtat] ?? selectedEtat}
                  </div>
                )}
              </>
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
