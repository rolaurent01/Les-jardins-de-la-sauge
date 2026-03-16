import React from 'react'

/** Wrapper label + input pour les formulaires SlideOver */
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
        {label}
        {required && <span style={{ color: '#BC6C25' }}> *</span>}
        {hint && (
          <span className="ml-1 font-normal text-xs" style={{ color: '#9CA89D' }}>
            ({hint})
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
