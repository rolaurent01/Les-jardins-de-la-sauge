'use client'

import MobileField from './MobileField'
import TimerInsertButton from './TimerInsertButton'

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
  /** Affiche le bouton "⏱️ Insérer" du timer à côté du label */
  showTimerInsert?: boolean
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
  showTimerInsert,
}: MobileInputProps) {
  return (
    <MobileField label={label} required={required} error={error} trailing={
      showTimerInsert ? <TimerInsertButton onInsert={onChange} /> : undefined
    }>
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
