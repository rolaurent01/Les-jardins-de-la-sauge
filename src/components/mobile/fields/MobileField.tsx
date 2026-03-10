'use client'

import type { ReactNode } from 'react'

interface MobileFieldProps {
  label: string
  required?: boolean
  error?: string | null
  children: ReactNode
  /** Élément affiché à droite du label (ex: bouton timer) */
  trailing?: ReactNode
}

/** Wrapper de champ mobile — label + enfant + message d'erreur */
export default function MobileField({ label, required, error, children, trailing }: MobileFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {trailing}
      </div>
      {children}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
