'use client'

import MobileField from './MobileField'

interface MobileInputProps {
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string | null
  /** Unité affichée à droite (ex: "g", "min") */
  suffix?: string
}

/** Input texte/number/date adapté mobile */
export default function MobileInput({
  label,
  required,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  suffix,
}: MobileInputProps) {
  return (
    <MobileField label={label} required={required} error={error}>
      <div className="relative">
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white"
          style={{
            height: 48,
            borderRadius: 10,
            border: '1px solid #E5E5E5',
            fontSize: 16,
            paddingLeft: 12,
            paddingRight: suffix ? 44 : 12,
            color: '#2C3E2D',
          }}
        />
        {suffix && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#999' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </MobileField>
  )
}
