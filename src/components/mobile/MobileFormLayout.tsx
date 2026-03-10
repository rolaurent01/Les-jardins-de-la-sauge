'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'

interface MobileFormLayoutProps {
  title: string
  backHref: string
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  success: boolean
  error: string | null
  children: ReactNode
  /** Callback appelé quand l'utilisateur veut recommencer une saisie */
  onReset?: () => void
}

/**
 * Layout réutilisable pour tous les formulaires mobiles.
 * Header + body scrollable + bouton submit sticky + écran de confirmation.
 */
export default function MobileFormLayout({
  title,
  backHref,
  onSubmit,
  isSubmitting,
  success,
  error,
  children,
  onReset,
}: MobileFormLayoutProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-retour après 2s de confirmation
  useEffect(() => {
    if (!success) return
    timerRef.current = setTimeout(() => {
      window.location.href = backHref
    }, 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [success, backHref])

  // Écran de confirmation
  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <span className="text-5xl">✅</span>
        <p className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          Enregistré
        </p>
        <div className="flex gap-3">
          {onReset && (
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current)
                onReset()
              }}
              className="px-5 py-3 rounded-xl text-sm font-medium bg-white"
              style={{
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
              }}
            >
              Nouvelle saisie
            </button>
          )}
          <Link
            href={backHref}
            className="px-5 py-3 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current)
            }}
          >
            Retour
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 56 }}
      >
        <Link
          href={backHref}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <span className="text-lg" style={{ color: '#2C3E2D' }}>←</span>
        </Link>
        <h1 className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          {title}
        </h1>
      </div>

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {children}
        </div>
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Bouton submit sticky */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-white font-medium text-base disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-primary)',
            borderRadius: 12,
            minHeight: 48,
          }}
        >
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
