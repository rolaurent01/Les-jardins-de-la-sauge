'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import type { Organization } from '@/lib/types'
import type { ActionResult } from '@/lib/types'

type Props = {
  open: boolean
  item: (Organization & { farmsCount?: number; usersCount?: number }) | null
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onLogoUpload: (orgId: string, fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const PLANS = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

export default function OrganisationSlideOver({ open, item, onClose, onSubmit, onLogoUpload, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstInput = useRef<HTMLInputElement>(null)

  // Champs du formulaire
  const [nom, setNom] = useState('')
  const [slug, setSlug] = useState('')
  const [nomAffiche, setNomAffiche] = useState('')
  const [plan, setPlan] = useState('starter')
  const [maxFarms, setMaxFarms] = useState('3')
  const [maxUsers, setMaxUsers] = useState('5')
  const [couleurPrimaire, setCouleurPrimaire] = useState('#3A5A40')
  const [couleurSecondaire, setCouleurSecondaire] = useState('#588157')

  // Sync avec item en édition
  useEffect(() => {
    if (item) {
      setNom(item.nom)
      setSlug(item.slug)
      setNomAffiche(item.nom_affiche ?? '')
      setPlan(item.plan)
      setMaxFarms(String(item.max_farms))
      setMaxUsers(String(item.max_users))
      setCouleurPrimaire(item.couleur_primaire)
      setCouleurSecondaire(item.couleur_secondaire)
    } else {
      setNom('')
      setSlug('')
      setNomAffiche('')
      setPlan('starter')
      setMaxFarms('3')
      setMaxUsers('5')
      setCouleurPrimaire('#3A5A40')
      setCouleurSecondaire('#588157')
    }
    setError(null)
  }, [item, open])

  // Focus sur le premier champ
  useEffect(() => {
    if (open) setTimeout(() => firstInput.current?.focus(), 100)
  }, [open])

  // Escape pour fermer
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, isPending, onClose])

  // Auto-slugify
  function handleNomChange(value: string) {
    setNom(value)
    if (!item) {
      setSlug(
        value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      )
    }
  }

  function handleSubmit() {
    setError(null)
    const fd = new FormData()
    fd.set('nom', nom)
    fd.set('slug', slug)
    fd.set('nom_affiche', nomAffiche)
    fd.set('plan', plan)
    fd.set('max_farms', maxFarms)
    fd.set('max_users', maxUsers)
    fd.set('couleur_primaire', couleurPrimaire)
    fd.set('couleur_secondaire', couleurSecondaire)

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !item) return
    const fd = new FormData()
    fd.set('logo', file)
    const result = await onLogoUpload(item.id, fd)
    if ('error' in result) setError(result.error)
  }

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #D8E0D9',
    fontSize: '13px',
    color: '#2C3E2D',
    backgroundColor: '#fff',
    width: '100%',
  }

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 500 as const,
    color: '#6B7280',
    marginBottom: '4px',
    display: 'block',
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '480px',
          zIndex: 50,
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: '#2C3E2D' }}>
            {item ? 'Modifier l\u2019organisation' : 'Nouvelle organisation'}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-[18px]"
            style={{ color: '#9CA3AF', lineHeight: 1 }}
          >
            &#x2715;
          </button>
        </div>

        {/* Formulaire */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div
              className="rounded-lg text-[13px]"
              style={{ padding: '10px 14px', backgroundColor: '#FDF3E8', color: '#BC6C25' }}
            >
              {error}
            </div>
          )}

          {/* Nom */}
          <div>
            <label style={labelStyle}>Nom *</label>
            <input
              ref={firstInput}
              type="text"
              value={nom}
              onChange={e => handleNomChange(e.target.value)}
              style={inputStyle}
              placeholder="Ex: Les Jardins de la Sauge"
            />
          </div>

          {/* Slug */}
          <div>
            <label style={labelStyle}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              style={inputStyle}
              placeholder="auto-genere-depuis-le-nom"
            />
          </div>

          {/* Nom affiché */}
          <div>
            <label style={labelStyle}>Nom affiché</label>
            <input
              type="text"
              value={nomAffiche}
              onChange={e => setNomAffiche(e.target.value)}
              style={inputStyle}
              placeholder="Nom court (sidebar)"
            />
          </div>

          {/* Plan */}
          <div>
            <label style={labelStyle}>Plan</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              style={inputStyle}
            >
              {PLANS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Limites */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>Max fermes</label>
              <input
                type="number"
                min="1"
                value={maxFarms}
                onChange={e => setMaxFarms(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="flex-1">
              <label style={labelStyle}>Max utilisateurs</label>
              <input
                type="number"
                min="1"
                value={maxUsers}
                onChange={e => setMaxUsers(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Couleurs */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>Couleur primaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={couleurPrimaire}
                  onChange={e => setCouleurPrimaire(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                  style={{ padding: 0 }}
                />
                <input
                  type="text"
                  value={couleurPrimaire}
                  onChange={e => setCouleurPrimaire(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
            <div className="flex-1">
              <label style={labelStyle}>Couleur secondaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={couleurSecondaire}
                  onChange={e => setCouleurSecondaire(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                  style={{ padding: 0 }}
                />
                <input
                  type="text"
                  value={couleurSecondaire}
                  onChange={e => setCouleurSecondaire(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>
          </div>

          {/* Logo (uniquement en édition) */}
          {item && (
            <div>
              <label style={labelStyle}>Logo</label>
              <div className="flex items-center gap-3">
                {item.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.logo_url}
                    alt="Logo"
                    className="w-10 h-10 rounded object-contain"
                    style={{ border: '1px solid #D8E0D9' }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: couleurPrimaire, fontSize: '14px' }}
                  >
                    {nom.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-[12px]"
                  style={{ color: '#6B7280' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg text-[13px] font-medium"
            style={{
              padding: '8px 16px',
              color: '#4B5563',
              border: '1px solid #D1D5DB',
              backgroundColor: '#fff',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg text-[13px] font-medium text-white"
            style={{
              padding: '8px 16px',
              backgroundColor: '#DC2626',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Enregistrement...' : item ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  )
}
