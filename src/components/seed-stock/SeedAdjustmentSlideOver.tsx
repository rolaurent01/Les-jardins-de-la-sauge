'use client'

import { useState, useTransition, useEffect } from 'react'
import { Field } from '@/components/ui/Field'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import type { ActionResult, SeedStockAdjustmentWithRelations, SeedStockLevel } from '@/lib/types'
import DateYearWarning from '@/components/shared/DateYearWarning'

type SeedLotOption = {
  id: string
  lot_interne: string
  variety_id: string | null
  poids_sachet_g: number | null
  varieties: { id: string; nom_vernaculaire: string } | null
}

type Props = {
  open: boolean
  onClose: () => void
  item: SeedStockAdjustmentWithRelations | null
  seedLots: SeedLotOption[]
  stockLevels: SeedStockLevel[]
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function SeedAdjustmentSlideOver({
  open,
  onClose,
  item,
  seedLots,
  stockLevels,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = item !== null

  const [selectedSeedLotId, setSelectedSeedLotId] = useState(item?.seed_lot_id ?? '')
  const [poidsValue, setPoidsValue] = useState(item?.poids_constate_g?.toString() ?? '')
  const [date, setDate] = useState(item?.date ?? '')

  useEffect(() => {
    setSelectedSeedLotId(item?.seed_lot_id ?? '')
    setPoidsValue(item?.poids_constate_g?.toString() ?? '')
    setDate(item?.date ?? '')
    setError(null)
  }, [item])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  // Stock actuel du sachet selectionne
  const currentStock = selectedSeedLotId
    ? stockLevels.find(s => s.seed_lot_id === selectedSeedLotId)?.stock_g ?? 0
    : null

  // Sachet selectionne (pour afficher le poids initial)
  const selectedLot = seedLots.find(s => s.id === selectedSeedLotId)

  const poidsNum = parseFloat(poidsValue) || 0
  const delta = currentStock !== null ? currentStock - poidsNum : null

  const titleLabel = isEdit ? 'Modifier l\'inventaire' : 'Nouvel inventaire'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('seed_lot_id', selectedSeedLotId)

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

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
            &#10005;
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-6 py-5 space-y-5 flex-1">
            {/* Sachet */}
            <Field label="Sachet" required>
              <select
                value={selectedSeedLotId}
                onChange={e => setSelectedSeedLotId(e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                disabled={isEdit}
                required
              >
                <option value="">Selectionner un sachet</option>
                {seedLots.map(lot => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lot_interne} — {lot.varieties?.nom_vernaculaire ?? 'Sans variete'}
                    {lot.poids_sachet_g ? ` (${lot.poids_sachet_g}g)` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {/* Info stock actuel */}
            {selectedSeedLotId && currentStock !== null && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: '#F5F2ED', border: '1px solid #D8E0D9' }}
              >
                <div className="flex justify-between mb-1">
                  <span style={{ color: '#9CA89D' }}>Poids initial</span>
                  <span style={{ color: '#2C3E2D', fontWeight: 500 }}>
                    {selectedLot?.poids_sachet_g ? `${selectedLot.poids_sachet_g} g` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#9CA89D' }}>Stock actuel calcule</span>
                  <span style={{ color: '#2C3E2D', fontWeight: 500 }}>
                    {formatWeight(currentStock)}
                  </span>
                </div>
              </div>
            )}

            {/* Date */}
            <Field label="Date de l'inventaire" required>
              <input
                type="date"
                name="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                required
              />
              <DateYearWarning date={date} />
            </Field>

            {/* Poids constate */}
            <Field label="Poids constate" required hint="en grammes">
              <input
                type="number"
                name="poids_constate_g"
                value={poidsValue}
                onChange={e => setPoidsValue(e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                min="0"
                step="0.01"
                required
              />
            </Field>

            {/* Apercu du delta */}
            {delta !== null && poidsValue !== '' && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{
                  backgroundColor: delta === 0 ? '#F5F2ED' : delta > 0 ? '#FEF3C7' : '#DCFCE7',
                  border: '1px solid',
                  borderColor: delta === 0 ? '#D8E0D9' : delta > 0 ? '#F59E0B' : '#22C55E',
                }}
              >
                {delta === 0 ? (
                  <span style={{ color: '#9CA89D' }}>Aucun ecart — le stock correspond</span>
                ) : delta > 0 ? (
                  <span style={{ color: '#92400E' }}>
                    Sortie de <strong>{formatWeight(delta)}</strong> (consommation)
                  </span>
                ) : (
                  <span style={{ color: '#166534' }}>
                    Entree de <strong>{formatWeight(-delta)}</strong> (correction a la hausse)
                  </span>
                )}
              </div>
            )}

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={item?.commentaire ?? ''}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                maxLength={1000}
              />
            </Field>

            {/* Erreur */}
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 flex gap-3 flex-shrink-0"
            style={{ borderTop: '1px solid #D8E0D9' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
              style={{ borderColor: '#D8E0D9', color: '#6B7B6C', backgroundColor: 'transparent' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedSeedLotId}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#F9F8F6',
                opacity: isPending || !selectedSeedLotId ? 0.5 : 1,
              }}
            >
              {isPending ? 'Enregistrement…' : isEdit ? 'Modifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  return `${g} g`
}
