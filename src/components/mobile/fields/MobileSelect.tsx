'use client'

import MobileField from './MobileField'

/** Groupe d'options pour les <optgroup> natifs */
export interface OptionGroup {
  group: string
  options: { value: string; label: string }[]
}

interface MobileSelectProps {
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  /** Options simples (sans groupement) */
  options?: { value: string; label: string }[]
  /** Options groupées via <optgroup> — mutuellement exclusif avec options */
  groupedOptions?: OptionGroup[]
  placeholder?: string
  error?: string | null
}

/** Select natif mobile — utilise le picker natif du device. Supporte les optgroup. */
export default function MobileSelect({
  label,
  required,
  value,
  onChange,
  options,
  groupedOptions,
  placeholder = 'Sélectionner…',
  error,
}: MobileSelectProps) {
  return (
    <MobileField label={label} required={required} error={error}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white appearance-none"
        style={{
          height: 48,
          borderRadius: 10,
          border: '1px solid #E5E5E5',
          fontSize: 16,
          paddingLeft: 12,
          paddingRight: 32,
          color: value ? '#2C3E2D' : '#999',
        }}
      >
        <option value="">{placeholder}</option>
        {groupedOptions
          ? groupedOptions.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
      </select>
    </MobileField>
  )
}
