'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createProductStockMovement } from '@/app/[orgSlug]/(dashboard)/produits/stock/actions'
import DateYearWarning from '@/components/shared/DateYearWarning'

type LotForSelect = {
  id: string
  numero_lot: string
  nb_unites: number | null
  recipe_nom: string
  type: 'lot' | 'conditionnement'
}

type Props = {
  open: boolean
  lots: LotForSelect[]
  stockByLot: Map<string, number>
  onClose: () => void
  onSuccess: () => void
}

export default function ProductStockSlideOver({ open, lots, stockByLot, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [typeMouvement, setTypeMouvement] = useState<'entree' | 'sortie'>('entree')
  const [selectedId, setSelectedId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [quantite, setQuantite] = useState('')
  const [commentaire, setCommentaire] = useState('')

  const firstFieldRef = useRef<HTMLSelectElement>(null)

  // Focus au premier champ a l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 300)
    }
  }, [open])

  // Echap pour fermer
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, isPending, onClose])

  // Reset a l'ouverture
  useEffect(() => {
    if (open) {
      setTypeMouvement('entree')
      setSelectedId('')
      setDate(new Date().toISOString().split('T')[0])
      setQuantite('')
      setCommentaire('')
      setError(null)
    }
  }, [open])

  const selectedItem = lots.find(l => l.id === selectedId)
  const currentStock = selectedId ? (stockByLot.get(selectedId) ?? 0) : null
  const qteNum = parseInt(quantite, 10)
  const isStockInsuffisant = typeMouvement === 'sortie' && currentStock != null && !isNaN(qteNum) && qteNum > currentStock

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    // Selon le type de source, envoyer le bon champ
    if (selectedItem?.type === 'conditionnement') {
      fd.set('conditionnement_id', selectedId)
    } else {
      fd.set('production_lot_id', selectedId)
    }
    fd.set('date', date)
    fd.set('type_mouvement', typeMouvement)
    fd.set('quantite', quantite)
    fd.set('commentaire', commentaire)

    startTransition(async () => {
      const result = await createProductStockMovement(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  // Grouper les lots par type pour un meilleur affichage
  const lotsProduit = lots.filter(l => l.type === 'lot')
  const lotsConditionne = lots.filter(l => l.type === 'conditionnement')

  return (
    <>
      {/* Overlay */}
      <div
        onClick={isPending ? undefined : onClose}
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
        aria-label="Nouveau mouvement de stock"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '500px',
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
            Nouveau mouvement de stock
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

            {/* Erreur */}
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}
              >
                {error}
              </div>
            )}

            {/* Type mouvement */}
            <Field label="Type de mouvement">
              <div className="flex gap-2">
                <ToggleBtn
                  active={typeMouvement === 'entree'}
                  onClick={() => setTypeMouvement('entree')}
                  color="#166534"
                  bgColor="#DCFCE7"
                >
                  Entree
                </ToggleBtn>
                <ToggleBtn
                  active={typeMouvement === 'sortie'}
                  onClick={() => setTypeMouvement('sortie')}
                  color="#991B1B"
                  bgColor="#FEE2E2"
                >
                  Sortie
                </ToggleBtn>
              </div>
            </Field>

            {/* Lot ou conditionnement */}
            <Field label="Lot / Conditionnement" required>
              <select
                ref={firstFieldRef}
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ backgroundColor: '#FFF', borderColor: '#D8E0D9', color: '#2C3E2D' }}
                required
              >
                <option value="">Selectionner…</option>
                {lotsProduit.length > 0 && (
                  <optgroup label="Lots (sachets)">
                    {lotsProduit.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lot} — {l.recipe_nom}
                      </option>
                    ))}
                  </optgroup>
                )}
                {lotsConditionne.length > 0 && (
                  <optgroup label="Mises en bouteille">
                    {lotsConditionne.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lot} — {l.recipe_nom}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {currentStock != null && (
                <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                  Stock actuel : {currentStock} {selectedItem?.type === 'conditionnement' ? 'bouteille' : 'sachet'}{currentStock !== 1 ? 's' : ''}
                </p>
              )}
            </Field>

            {/* Date */}
            <Field label="Date" required>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ backgroundColor: '#FFF', borderColor: '#D8E0D9', color: '#2C3E2D' }}
                required
              />
              <DateYearWarning date={date} />
            </Field>

            {/* Quantite */}
            <Field label={`Quantite (${selectedItem?.type === 'conditionnement' ? 'bouteilles' : 'sachets'})`} required>
              <input
                type="number"
                value={quantite}
                onChange={e => setQuantite(e.target.value)}
                min={1}
                step={1}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ backgroundColor: '#FFF', borderColor: '#D8E0D9', color: '#2C3E2D' }}
                required
              />
              {isStockInsuffisant && (
                <p
                  className="text-xs mt-1 font-medium"
                  style={{ color: '#D97706' }}
                >
                  Stock insuffisant ({currentStock} disponible{currentStock !== 1 ? 's' : ''})
                </p>
              )}
            </Field>

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none"
                style={{ backgroundColor: '#FFF', borderColor: '#D8E0D9', color: '#2C3E2D' }}
              />
            </Field>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid #D8E0D9' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedId}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Sous-composants ---- */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#6B7B6C' }}>
        {label}
        {required && <span style={{ color: '#DC2626' }}> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function ToggleBtn({
  active,
  onClick,
  color,
  bgColor,
  children,
}: {
  active: boolean
  onClick: () => void
  color: string
  bgColor: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
      style={{
        backgroundColor: active ? bgColor : '#FFF',
        color: active ? color : '#9CA89D',
        borderColor: active ? bgColor : '#D8E0D9',
      }}
    >
      {children}
    </button>
  )
}
