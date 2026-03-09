'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { conditionnerLot } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'

type Props = {
  lotId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ConditionnerModal({ lotId, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await conditionnerLot(lotId, fd)
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
        aria-label="Conditionner le lot"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 80,
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#FAF5E9',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '24px',
        }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: '#2C3E2D' }}>
          Conditionner le lot
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Nombre de sachets/pots <span style={{ color: '#BC6C25' }}>*</span>
            </label>
            <input
              ref={inputRef}
              name="nb_unites"
              type="number"
              required
              min="1"
              step="1"
              disabled={isPending}
              placeholder="ex: 50"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid #D8E0D9',
                backgroundColor: '#F9F8F6',
                color: '#2C3E2D',
                outline: 'none',
              }}
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
