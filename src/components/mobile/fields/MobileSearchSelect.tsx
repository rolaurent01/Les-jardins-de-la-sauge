'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import MobileField from './MobileField'
import { normalize } from '@/lib/utils/normalize'

interface Option {
  value: string
  label: string
  sublabel?: string
}

interface MobileSearchSelectProps {
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: string | null
  searchPlaceholder?: string
}



/** Recherche et tri par pertinence */
function searchAndSort(options: Option[], term: string): Option[] {
  const normalized = normalize(term)
  if (!normalized) return options

  return options
    .map(opt => {
      const lbl = normalize(opt.label)
      const sub = normalize(opt.sublabel ?? '')
      let score = 0

      if (lbl.startsWith(normalized)) score = 100
      else if (lbl.split(/\s+/).some(w => w.startsWith(normalized))) score = 80
      else if (lbl.includes(normalized)) score = 60
      else if (sub.startsWith(normalized)) score = 40
      else if (sub.includes(normalized)) score = 20

      return { opt, score }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.opt.label.localeCompare(b.opt.label, 'fr', { sensitivity: 'base' })
    })
    .map(r => r.opt)
}

/**
 * Select mobile avec recherche en plein écran (modale).
 * Conçu pour les listes longues (90+ variétés).
 * Recherche insensible aux accents et à la casse, triée par pertinence.
 */
export default function MobileSearchSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  error,
  searchPlaceholder = 'Rechercher…',
}: MobileSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(o => o.value === value)

  // Filtrer et trier les options par pertinence
  const filtered = useMemo(
    () => searchAndSort(options, search),
    [options, search],
  )

  // Autofocus sur l'input à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Bloquer le scroll du body quand ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  // Fermer avec Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  function handleSelect(optValue: string) {
    onChange(optValue)
    setIsOpen(false)
  }

  return (
    <MobileField label={label} required={required} error={error}>
      {/* Bouton déclencheur — même style que MobileSelect */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full bg-white text-left"
        style={{
          height: 48,
          borderRadius: 10,
          border: '1px solid #E5E5E5',
          fontSize: 16,
          paddingLeft: 12,
          paddingRight: 32,
          color: value ? '#2C3E2D' : '#999',
          position: 'relative',
        }}
      >
        <span className="block truncate">
          {selectedOption?.label ?? placeholder}
        </span>
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: '#999',
            pointerEvents: 'none',
          }}
        >
          ▼
        </span>
      </button>

      {/* Modale plein écran */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header fixe */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid #E5E5E5',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer"
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                color: '#666',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#2C3E2D' }}>
              {label}
            </span>
          </div>

          {/* Input recherche fixe */}
          <div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  pointerEvents: 'none',
                }}
              >
                🔍
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: '#F3F4F6',
                  fontSize: 16,
                  paddingLeft: 34,
                  paddingRight: 12,
                  outline: 'none',
                  color: '#2C3E2D',
                }}
              />
            </div>
          </div>

          {/* Liste des options — scrollable */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {filtered.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: '#999',
                  fontSize: 14,
                }}
              >
                Aucun résultat
              </p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: '1px solid #F3F4F6',
                    backgroundColor: opt.value === value ? 'rgba(76,110,60,0.06)' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: '#2C3E2D',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#999',
                          fontStyle: 'italic',
                          marginTop: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  {opt.value === value && (
                    <span
                      style={{
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        fontSize: 16,
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </MobileField>
  )
}
