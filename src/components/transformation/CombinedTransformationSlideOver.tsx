'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Field } from '@/components/ui/Field'
import type { ActionResult, PartiePlante } from '@/lib/types'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import type { Variety } from '@/lib/types'
import type { TransformationModuleConfig, CombinedTransformationRow } from './types'
import { ETAT_PLANTE_LABELS } from './types'
import type { StockEntry } from '@/app/[orgSlug]/(dashboard)/stock/vue-stock/actions'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import DateYearWarning from '@/components/shared/DateYearWarning'

/** Clé composite pour identifier une ligne de stock */
function stockKey(s: { variety_id: string; partie_plante: string; etat_plante: string }): string {
  return `${s.variety_id}::${s.partie_plante}::${s.etat_plante}`
}

/** Parse une clé composite en ses composants */
function parseStockKey(key: string): { variety_id: string; partie_plante: string; etat_plante: string } | null {
  const parts = key.split('::')
  if (parts.length !== 3) return null
  return { variety_id: parts[0], partie_plante: parts[1], etat_plante: parts[2] }
}

/** Formate le stock en g ou kg */
function formatStockG(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

type Props = {
  config: TransformationModuleConfig
  open: boolean
  onClose: () => void
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  stockEntries?: StockEntry[]
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSubmitUpdate?: (id: string, fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
  editItem?: CombinedTransformationRow | null
}

export default function CombinedTransformationSlideOver({
  config,
  open,
  onClose,
  varieties: catalogVarieties,
  stockEntries = [],
  onSubmit,
  onSubmitUpdate,
  onSuccess,
  editItem,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // ---- State du formulaire ----
  const [selectedStockKey, setSelectedStockKey] = useState('')
  const [selectedVarietyId, setSelectedVarietyId] = useState('')
  const [selectedPartie, setSelectedPartie] = useState('')
  const [selectedEtat, setSelectedEtat] = useState('')
  const [poidsEntree, setPoidsEntree] = useState('')
  const [poidsSortie, setPoidsSortie] = useState('')
  const [sortieManuallyEdited, setSortieManuallyEdited] = useState(false)
  const [date, setDate] = useState('')

  const isTronconnage = config.module === 'tronconnage'
  const isEditing = editItem != null

  // Map variétés par id pour lookup rapide
  const varietyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of catalogVarieties) m.set(v.id, v.nom_vernaculaire)
    return m
  }, [catalogVarieties])

  // Stock dispo pour la ligne sélectionnée
  const selectedStockDispo = useMemo(() => {
    if (!selectedStockKey) return null
    const entry = stockEntries.find(s => stockKey(s) === selectedStockKey)
    return entry?.stock_g ?? null
  }, [selectedStockKey, stockEntries])

  // Reset / pre-fill à l'ouverture
  useEffect(() => {
    if (open) {
      if (editItem) {
        const etat = editItem.etat_plante ?? config.etatEntreeImplicite ?? ''
        const key = stockKey({ variety_id: editItem.variety_id, partie_plante: editItem.partie_plante, etat_plante: etat })
        setSelectedStockKey(key)
        setSelectedVarietyId(editItem.variety_id)
        setSelectedPartie(editItem.partie_plante)
        setSelectedEtat(etat)
        setPoidsEntree(String(editItem.poids_entree_g))
        setPoidsSortie(editItem.poids_sortie_g != null ? String(editItem.poids_sortie_g) : '')
        setSortieManuallyEdited(true)
        setDate(editItem.date)
      } else {
        setSelectedStockKey('')
        setSelectedVarietyId('')
        setSelectedPartie('')
        setSelectedEtat('')
        setPoidsEntree('')
        setPoidsSortie('')
        setSortieManuallyEdited(false)
        setDate('')
      }
      setError(null)
    }
  }, [open, editItem, config.etatEntreeImplicite])

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  function handleStockSelect(key: string) {
    setSelectedStockKey(key)
    const parsed = parseStockKey(key)
    if (parsed) {
      setSelectedVarietyId(parsed.variety_id)
      setSelectedPartie(parsed.partie_plante)
      setSelectedEtat(parsed.etat_plante)
    } else {
      setSelectedVarietyId('')
      setSelectedPartie('')
      setSelectedEtat('')
    }
  }

  // Tronconnage : auto-sync poids sortie = poids entree
  function handlePoidsEntreeChange(value: string) {
    setPoidsEntree(value)
    if (isTronconnage && !sortieManuallyEdited) {
      setPoidsSortie(value)
    }
  }

  function handlePoidsSortieChange(value: string) {
    setPoidsSortie(value)
    setSortieManuallyEdited(true)
  }

  // Calcul dechet pour le triage
  const poidsEntreeNum = parseFloat(poidsEntree) || 0
  const poidsSortieNum = parseFloat(poidsSortie) || 0
  const dechet = poidsEntreeNum > 0 && poidsSortieNum > 0
    ? Math.round((poidsEntreeNum - poidsSortieNum) * 100) / 100
    : null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('variety_id', selectedVarietyId)
    fd.set('partie_plante', selectedPartie)
    fd.set('poids_entree_g', poidsEntree)
    fd.set('poids_sortie_g', poidsSortie)

    if (config.etatsEntree !== null) {
      fd.set('etat_plante', selectedEtat)
    }

    startTransition(async () => {
      const result = isEditing && onSubmitUpdate
        ? await onSubmitUpdate(editItem.id, fd)
        : await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const moduleLabel = config.module === 'tronconnage' ? 'tronconnage' : 'triage'
  const titleLabel = isEditing ? `Modifier ${moduleLabel}` : `Nouveau ${moduleLabel}`

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
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            {titleLabel}
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

            {/* Sélecteur stock source */}
            <Field label="Stock source" required>
              <select
                name="_stock_key"
                required
                value={selectedStockKey}
                onChange={e => handleStockSelect(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Choisir dans le stock</option>
                {stockEntries.map(s => (
                  <option key={stockKey(s)} value={stockKey(s)}>
                    {s.nom_vernaculaire} — {PARTIE_PLANTE_LABELS[s.partie_plante as PartiePlante] ?? s.partie_plante} — {ETAT_PLANTE_LABELS[s.etat_plante] ?? s.etat_plante} ({formatStockG(s.stock_g)})
                  </option>
                ))}
              </select>
              {stockEntries.length === 0 && (
                <p className="text-xs mt-1" style={{ color: '#BC6C25' }}>
                  Aucun stock disponible pour ce type de transformation.
                </p>
              )}
            </Field>

            {/* Stock dispo (rappel visuel) */}
            {selectedStockDispo !== null && (
              <div
                className="px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: '#F0F4F0',
                  border: '1px solid #E0E6E0',
                  color: '#6B7B6C',
                }}
              >
                Stock disponible : {formatStockG(selectedStockDispo)}
              </div>
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

            {/* Poids entree + sortie */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Poids entree (g)" required>
                <input
                  name="poids_entree_g"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={poidsEntree}
                  onChange={e => handlePoidsEntreeChange(e.target.value)}
                  disabled={isPending}
                  placeholder="en grammes"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              <Field label="Poids sortie (g)" required>
                <input
                  name="poids_sortie_g"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={poidsSortie}
                  onChange={e => handlePoidsSortieChange(e.target.value)}
                  disabled={isPending}
                  placeholder="en grammes"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Warning si poids > stock */}
            {selectedStockDispo !== null && poidsEntreeNum > selectedStockDispo && (
              <div
                className="px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B44',
                  color: '#92400E',
                }}
              >
                Le poids d&apos;entree ({poidsEntreeNum} g) depasse le stock disponible ({formatStockG(selectedStockDispo)}).
              </div>
            )}

            {/* Ligne dechet (triage) */}
            {!isTronconnage && dechet !== null && dechet >= 0 && (
              <div
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: dechet > 0 ? '#FEF3C7' : '#DCFCE7',
                  color: dechet > 0 ? '#92400E' : '#166534',
                  border: `1px solid ${dechet > 0 ? '#F59E0B44' : '#16653444'}`,
                }}
              >
                Dechet : {dechet} g ({poidsEntreeNum > 0 ? Math.round(dechet / poidsEntreeNum * 100) : 0} %)
              </div>
            )}

            {/* Tronconnage hint */}
            {isTronconnage && !sortieManuallyEdited && poidsEntree && (
              <p className="text-xs px-1" style={{ color: '#9CA89D' }}>
                Poids sortie pre-rempli = poids entree (modifiable)
              </p>
            )}

            {/* Grille temps */}
            <Field label="Temps (min)">
              <input
                name="temps_min"
                type="number"
                min="1"
                step="1"
                disabled={isPending}
                placeholder="en minutes"
                defaultValue={editItem?.temps_min ?? ''}
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
                disabled={isPending}
                placeholder="Observations…"
                defaultValue={editItem?.commentaire ?? ''}
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
              {isPending ? 'Enregistrement…' : isEditing ? 'Modifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
