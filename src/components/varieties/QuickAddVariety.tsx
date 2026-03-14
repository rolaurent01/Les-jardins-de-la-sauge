'use client'

/**
 * QuickAddVariety — Composant réutilisable "＋ Nouvelle variété"
 *
 * Usage dans n'importe quel formulaire qui a un sélecteur de variété :
 *
 * ```tsx
 * <QuickAddVariety
 *   existingVarieties={varieties}
 *   onCreated={(newVariety) => setSelectedVariety(newVariety)}
 * />
 * ```
 *
 * - 3 champs seulement : nom vernaculaire (obligatoire), nom latin, famille
 * - Anti-doublon client-side + gestion de la contrainte UNIQUE serveur
 * - Si la variété existe déjà, propose de la sélectionner directement
 */

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Variety, PartiePlante } from '@/lib/types'
import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'
import { createVariety } from '@/app/[orgSlug]/(dashboard)/referentiel/varietes/actions'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const FAMILLES = [
  'Lamiacées', 'Astéracées', 'Malvacées', 'Verbénacées',
  'Papavéracées', 'Apiacées', 'Scrophulariacées', 'Valérianacées',
  'Rosacées', 'Boraginacées',
]

type Props = {
  existingVarieties: Variety[]
  onCreated: (variety: Variety) => void
}

export default function QuickAddVariety({ existingVarieties, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Variety | null>(null)
  const [selectedParties, setSelectedParties] = useState<PartiePlante[]>(['plante_entiere'])
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null)

  function togglePartie(partie: PartiePlante) {
    setSelectedParties(prev =>
      prev.includes(partie)
        ? prev.filter(p => p !== partie)
        : [...prev, partie]
    )
  }

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPortalPos({ top: rect.bottom + 6, left: Math.max(8, rect.left) })
    }
  }, [])

  useEffect(() => {
    if (open) {
      updatePosition()
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open, updatePosition])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) {
        setOpen(false)
        setError(null)
        setDuplicate(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setDuplicate(null)

    const fd = new FormData(e.currentTarget)
    const nom = (fd.get('nom_vernaculaire') as string).trim()

    if (!nom) {
      setError('Le nom vernaculaire est obligatoire.')
      return
    }

    if (selectedParties.length === 0) {
      setError('Sélectionnez au moins une partie utilisée.')
      return
    }

    // Vérification client-side (rapide, avant le round-trip serveur)
    const existing = existingVarieties.find(
      v => !v.deleted_at && normalize(v.nom_vernaculaire) === normalize(nom)
    )
    if (existing) {
      setDuplicate(existing)
      return
    }

    startTransition(async () => {
      const result = await createVariety(fd)
      if ('error' in result) {
        // Erreur UNIQUE côté serveur (doublon insensible à la casse/accents)
        if (result.error.includes('doublon')) {
          const found = existingVarieties.find(
            v => normalize(v.nom_vernaculaire) === normalize(nom)
          )
          if (found) { setDuplicate(found); return }
        }
        setError(result.error)
      } else if (result.data) {
        onCreated(result.data)
        setOpen(false)
        setError(null)
        setSelectedParties(['plante_entiere'])
      }
    })
  }

  function selectDuplicate() {
    if (duplicate) {
      onCreated(duplicate)
      setOpen(false)
      setDuplicate(null)
    }
  }

  return (
    <div className="relative inline-block">
      {/* Bouton déclencheur */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen(o => !o); setError(null); setDuplicate(null); setSelectedParties(['plante_entiere']) }}
        className="flex items-center gap-1 text-sm transition-colors"
        style={{ color: 'var(--color-primary-light)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary-light)')}
      >
        <span className="text-base leading-none">＋</span>
        <span>Nouvelle variété</span>
      </button>

      {/* ---- Mini-modal via portal (évite les <form> imbriqués) ---- */}
      {open && portalPos && createPortal(
        <>
          {/* Overlay transparent pour fermer en cliquant ailleurs */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
            onClick={() => { setOpen(false); setError(null); setDuplicate(null); setSelectedParties(['plante_entiere']) }}
          />

          <div
            style={{
              position: 'fixed',
              top: portalPos.top,
              left: portalPos.left,
              zIndex: 61,
              width: '320px',
              maxHeight: 'calc(100vh - 40px)',
              overflowY: 'auto',
              backgroundColor: '#FAF5E9',
              border: '1px solid #D8E0D9',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              padding: '16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9CA89D' }}>
              Ajout rapide de variété
            </p>

            {/* Message doublon */}
            {duplicate && (
              <div
                className="mb-3 p-3 rounded-lg text-sm"
                style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE68A' }}
              >
                <p className="font-medium" style={{ color: '#92400E' }}>
                  « {duplicate.nom_vernaculaire} » existe déjà.
                </p>
                <button
                  type="button"
                  onClick={selectDuplicate}
                  className="mt-1.5 text-sm underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Sélectionner cette variété →
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Nom vernaculaire */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#2C3E2D' }}>
                  Nom vernaculaire <span style={{ color: '#BC6C25' }}>*</span>
                </label>
                <input
                  ref={inputRef}
                  name="nom_vernaculaire"
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="ex : Lavande vraie"
                  style={miniInputStyle}
                  onFocus={e => ((e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)')}
                  onBlur={e  => ((e.target as HTMLInputElement).style.borderColor = '#D8E0D9')}
                />
              </div>

              {/* Nom latin */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#2C3E2D' }}>
                  Nom latin
                </label>
                <input
                  name="nom_latin"
                  type="text"
                  disabled={isPending}
                  placeholder="ex : Lavandula angustifolia"
                  style={{ ...miniInputStyle, fontStyle: 'italic' }}
                  onFocus={e => ((e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)')}
                  onBlur={e  => ((e.target as HTMLInputElement).style.borderColor = '#D8E0D9')}
                />
              </div>

              {/* Famille */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#2C3E2D' }}>
                  Famille
                </label>
                <input
                  name="famille"
                  type="text"
                  list="qa-familles-list"
                  disabled={isPending}
                  placeholder="ex : Lamiacées"
                  style={miniInputStyle}
                  onFocus={e => ((e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)')}
                  onBlur={e  => ((e.target as HTMLInputElement).style.borderColor = '#D8E0D9')}
                />
                <datalist id="qa-familles-list">
                  {FAMILLES.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              {/* Parties utilisées */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
                  Parties utilisées <span style={{ color: '#BC6C25' }}>*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PARTIES_PLANTE.map(partie => {
                    const checked = selectedParties.includes(partie)
                    return (
                      <label
                        key={partie}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '20px',
                          border: `1px solid ${checked ? 'var(--color-primary)' : '#D8E0D9'}`,
                          backgroundColor: checked ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : '#F9F8F6',
                          cursor: isPending ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          color: checked ? '#2C3E2D' : '#6B7B6C',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          name="parties_utilisees"
                          value={partie}
                          checked={checked}
                          disabled={isPending}
                          onChange={() => togglePartie(partie)}
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                        {PARTIE_PLANTE_LABELS[partie]}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <p className="text-xs" style={{ color: '#BC6C25' }}>{error}</p>
              )}

              {/* Boutons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError(null); setDuplicate(null); setSelectedParties(['plante_entiere']) }}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs rounded-lg border"
                  style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#F9F8F6',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

const miniInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: '13px',
  borderRadius: '7px',
  border: '1px solid #D8E0D9',
  backgroundColor: '#F9F8F6',
  color: '#2C3E2D',
  outline: 'none',
}
