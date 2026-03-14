'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import MobileField from './MobileField'

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

/** Normalise une chaîne pour la recherche (supprime accents, lowercase) */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Select mobile avec recherche en bottom-sheet.
 * Conçu pour les listes longues (90+ variétés).
 * Recherche insensible aux accents et à la casse.
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

  // Filtrer les options selon la recherche
  const filtered = useMemo(() => {
    if (!search) return options
    const term = normalize(search)
    return options.filter(
      opt =>
        normalize(opt.label).includes(term) ||
        (opt.sublabel && normalize(opt.sublabel).includes(term))
    )
  }, [options, search])

  // Autofocus sur l'input à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      // Petit délai pour laisser le DOM se rendre
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

      {/* Bottom-sheet */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 9990,
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9991,
              backgroundColor: '#fff',
              borderRadius: '16px 16px 0 0',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            {/* Poignée */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#ddd',
                margin: '10px auto 0',
                flexShrink: 0,
              }}
            />

            {/* Header : recherche + fermer */}
            <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
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
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: '#F3F4F6',
                    fontSize: 16,
                    paddingLeft: 34,
                    paddingRight: 36,
                    outline: 'none',
                    color: '#2C3E2D',
                  }}
                />
                {/* Bouton fermer */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer"
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: 18,
                    color: '#999',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Liste des options */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 8px',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              }}
            >
              {filtered.length === 0 ? (
                <p
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
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
                      minHeight: 48,
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: 8,
                      backgroundColor: opt.value === value ? 'rgba(76,110,60,0.08)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
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
        </>
      )}
    </MobileField>
  )
}
