'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createConditionnement } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import DateYearWarning from '@/components/shared/DateYearWarning'

type Props = {
  lotId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ConditionnerModal({ lotId, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [dateCond, setDateCond] = useState(() => new Date().toISOString().split('T')[0])
  const [nbUnites, setNbUnites] = useState('')
  const [tempsMin, setTempsMin] = useState('')
  const [ddm, setDdm] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 24)
    return d.toISOString().split('T')[0]
  })
  const [commentaire, setCommentaire] = useState('')

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPending, onClose])

  // Recalculer la DDM quand la date change
  useEffect(() => {
    if (dateCond) {
      const d = new Date(dateCond)
      d.setMonth(d.getMonth() + 24)
      setDdm(d.toISOString().split('T')[0])
    }
  }, [dateCond])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('production_lot_id', lotId)
    fd.set('date_conditionnement', dateCond)
    fd.set('nb_unites', nbUnites)
    fd.set('temps_min', tempsMin)
    fd.set('ddm', ddm)
    fd.set('commentaire', commentaire)

    startTransition(async () => {
      const result = await createConditionnement(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid #D8E0D9',
    backgroundColor: '#F9F8F6',
    color: '#2C3E2D',
    outline: 'none',
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal centree */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mise en bouteille"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 80,
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FAF5E9',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '24px',
        }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: '#2C3E2D' }}>
          Mise en bouteille
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date de conditionnement */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Date de mise en bouteille <span style={{ color: '#BC6C25' }}>*</span>
            </label>
            <input
              ref={inputRef}
              type="date"
              value={dateCond}
              onChange={e => setDateCond(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              disabled={isPending}
              style={inputStyle}
            />
            <DateYearWarning date={dateCond} />
          </div>

          {/* Nombre de bouteilles */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Nombre de bouteilles <span style={{ color: '#BC6C25' }}>*</span>
            </label>
            <input
              type="number"
              value={nbUnites}
              onChange={e => setNbUnites(e.target.value)}
              required
              min="1"
              step="1"
              disabled={isPending}
              placeholder="ex: 24"
              style={inputStyle}
            />
          </div>

          {/* Temps de travail */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Temps de travail (min)
            </label>
            <input
              type="number"
              value={tempsMin}
              onChange={e => setTempsMin(e.target.value)}
              min="1"
              step="1"
              disabled={isPending}
              placeholder="ex: 45"
              style={inputStyle}
            />
          </div>

          {/* DDM */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              DDM
            </label>
            <input
              type="date"
              value={ddm}
              onChange={e => setDdm(e.target.value)}
              disabled={isPending}
              style={inputStyle}
            />
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Commentaire
            </label>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              disabled={isPending}
              rows={2}
              maxLength={1000}
              placeholder="Notes sur la mise en bouteille…"
              className="resize-none"
              style={{ ...inputStyle, fontSize: '13px' }}
            />
          </div>

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

          <div className="flex items-center justify-end gap-3 pt-2">
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
              {isPending ? 'En cours…' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
