'use client'

import MobileField from './MobileField'

interface MobileTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

/** Zone de texte mobile pour les commentaires */
export default function MobileTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: MobileTextareaProps) {
  return (
    <MobileField label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-white resize-none"
        style={{
          borderRadius: 10,
          border: '1px solid #E5E5E5',
          fontSize: 16,
          padding: 12,
          color: '#2C3E2D',
        }}
      />
    </MobileField>
  )
}
