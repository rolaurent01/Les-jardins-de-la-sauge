'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import type { OrgWithFarms } from '@/app/[orgSlug]/(dashboard)/admin/utilisateurs/actions'
import type { ActionResult, MembershipRole } from '@/lib/types'

type Props = {
  open: boolean
  orgsWithFarms: OrgWithFarms[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const ROLES: { value: MembershipRole; label: string }[] = [
  { value: 'member', label: 'Membre' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
]

export default function UserCreateSlideOver({ open, orgsWithFarms, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstInput = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [role, setRole] = useState<MembershipRole>('member')
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])

  const selectedOrg = orgsWithFarms.find(o => o.id === organizationId)

  useEffect(() => {
    setEmail('')
    setPassword('')
    setOrganizationId(orgsWithFarms[0]?.id ?? '')
    setRole('member')
    setSelectedFarmIds([])
    setError(null)
  }, [open, orgsWithFarms])

  // Reset fermes quand on change d'organisation
  useEffect(() => {
    setSelectedFarmIds([])
  }, [organizationId])

  useEffect(() => {
    if (open) setTimeout(() => firstInput.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, isPending, onClose])

  function toggleFarm(farmId: string) {
    setSelectedFarmIds(prev =>
      prev.includes(farmId) ? prev.filter(id => id !== farmId) : [...prev, farmId]
    )
  }

  function handleSubmit() {
    setError(null)
    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('organization_id', organizationId)
    fd.set('role', role)
    fd.set('farm_ids', selectedFarmIds.join(','))

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
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
          position: 'fixed', inset: 0,
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
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '480px', zIndex: 50,
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: '#2C3E2D' }}>
            Nouvel utilisateur
          </h2>
          <button onClick={onClose} disabled={isPending} className="text-[18px]" style={{ color: '#9CA3AF', lineHeight: 1 }}>
            &#x2715;
          </button>
        </div>

        {/* Formulaire */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg text-[13px]" style={{ padding: '10px 14px', backgroundColor: '#FDF3E8', color: '#BC6C25' }}>
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>Email *</label>
            <input
              ref={firstInput}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="utilisateur@exemple.com"
            />
          </div>

          <div>
            <label style={labelStyle}>Mot de passe temporaire *</label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Minimum 6 caractères"
            />
          </div>

          <div>
            <label style={labelStyle}>Organisation *</label>
            <select
              value={organizationId}
              onChange={e => setOrganizationId(e.target.value)}
              style={inputStyle}
            >
              {orgsWithFarms.map(o => (
                <option key={o.id} value={o.id}>{o.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Rôle *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as MembershipRole)}
              style={inputStyle}
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Sélection des fermes (uniquement pour les members) */}
          {role === 'member' && selectedOrg && selectedOrg.farms.length > 0 && (
            <div>
              <label style={labelStyle}>Accès aux fermes</label>
              <p className="text-[11px] mb-2" style={{ color: '#9CA3AF' }}>
                Les owners et admins ont accès à toutes les fermes automatiquement.
              </p>
              <div className="space-y-2">
                {selectedOrg.farms.map(farm => (
                  <label
                    key={farm.id}
                    className="flex items-center gap-2 cursor-pointer text-[13px]"
                    style={{ color: '#2C3E2D' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFarmIds.includes(farm.id)}
                      onChange={() => toggleFarm(farm.id)}
                      className="rounded"
                    />
                    {farm.nom}
                  </label>
                ))}
              </div>
            </div>
          )}

          {role !== 'member' && (
            <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
              Les {role === 'owner' ? 'owners' : 'admins'} ont accès à toutes les fermes de l&apos;organisation.
            </p>
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
            style={{ padding: '8px 16px', color: '#4B5563', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg text-[13px] font-medium text-white"
            style={{ padding: '8px 16px', backgroundColor: '#DC2626', opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? 'Création...' : 'Créer l\u2019utilisateur'}
          </button>
        </div>
      </div>
    </>
  )
}
