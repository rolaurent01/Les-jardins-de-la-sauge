'use client'

interface MobileCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Checkbox mobile — toute la ligne est cliquable */
export default function MobileCheckbox({ label, checked, onChange }: MobileCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full bg-white"
      style={{
        height: 48,
        borderRadius: 10,
        border: '1px solid #E5E5E5',
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: checked ? 'none' : '2px solid #CCC',
          backgroundColor: checked ? 'var(--color-primary)' : 'transparent',
          color: '#fff',
          fontSize: 14,
        }}
      >
        {checked && '✓'}
      </span>
      <span className="text-sm" style={{ color: '#2C3E2D', fontSize: 16 }}>
        {label}
      </span>
    </button>
  )
}
