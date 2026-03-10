'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UserWithRelations, OrgWithFarms } from '@/app/[orgSlug]/(dashboard)/admin/utilisateurs/actions'
import type { MembershipRole, ActionResult } from '@/lib/types'

type Props = {
  open: boolean
  user: UserWithRelations | null
  orgsWithFarms: OrgWithFarms[]
  onClose: () => void
  onUpdateRole: (membershipId: string, role: MembershipRole) => Promise<void>
  onAddFarmAccess: (userId: string, farmId: string) => Promise<void>
  onRemoveFarmAccess: (farmAccessId: string) => Promise<void>
  onResetPassword: (userId: string, newPassword: string) => Promise<ActionResult>
}

const ROLES: { value: MembershipRole; label: string }[] = [
  { value: 'member', label: 'Membre' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
]

export default function UserEditSlideOver({
  open, user, orgsWithFarms, onClose,
  onUpdateRole, onAddFarmAccess, onRemoveFarmAccess, onResetPassword,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNewPassword('')
    setPasswordMsg(null)
    setError(null)
  }, [user, open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!user) return null

  // Trouver les fermes accessibles par organisation du user
  const userOrgIds = user.memberships.map(m => m.organization_id)
  const relevantOrgs = orgsWithFarms.filter(o => userOrgIds.includes(o.id))

  async function handleResetPassword() {
    if (!user) return
    setPasswordMsg(null)
    const result = await onResetPassword(user.id, newPassword)
    if ('error' in result) {
      setPasswordMsg(result.error)
    } else {
      setPasswordMsg('Mot de passe réinitialisé.')
      setNewPassword('')
    }
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
        onClick={onClose}
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
          width: '100%', maxWidth: '520px', zIndex: 50,
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
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: '#2C3E2D' }}>
              Modifier l&apos;utilisateur
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: '#6B7280' }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="text-[18px]" style={{ color: '#9CA3AF', lineHeight: 1 }}>
            &#x2715;
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {error && (
            <div className="rounded-lg text-[13px]" style={{ padding: '10px 14px', backgroundColor: '#FDF3E8', color: '#BC6C25' }}>
              {error}
            </div>
          )}

          {/* Memberships */}
          <div>
            <label style={labelStyle}>Organisations & rôles</label>
            {user.memberships.length === 0 && (
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>Aucune organisation.</p>
            )}
            <div className="space-y-2">
              {user.memberships.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg"
                  style={{ padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #E5E7EB' }}
                >
                  <span className="text-[13px] font-medium">{m.organization_name}</span>
                  <select
                    value={m.role}
                    onChange={e => {
                      onUpdateRole(m.id, e.target.value as MembershipRole)
                      startTransition(() => router.refresh())
                    }}
                    className="rounded text-[12px]"
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #D8E0D9',
                      backgroundColor: '#F9FAFB',
                      color: '#2C3E2D',
                    }}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Accès fermes */}
          <div>
            <label style={labelStyle}>Accès aux fermes</label>
            {user.memberships.some(m => m.role !== 'member') && (
              <p className="text-[11px] mb-2" style={{ color: '#9CA3AF' }}>
                Les owners/admins ont accès à toutes les fermes automatiquement.
              </p>
            )}

            {relevantOrgs.map(org => (
              <div key={org.id} className="mb-3">
                <p className="text-[12px] font-medium mb-1" style={{ color: '#4B5563' }}>
                  {org.nom}
                </p>
                <div className="space-y-1.5">
                  {org.farms.map(farm => {
                    const access = user.farmAccess.find(fa => fa.farm_id === farm.id)
                    return (
                      <div
                        key={farm.id}
                        className="flex items-center justify-between rounded"
                        style={{ padding: '6px 10px', backgroundColor: '#fff', border: '1px solid #F3F4F6' }}
                      >
                        <span className="text-[13px]">{farm.nom}</span>
                        {access ? (
                          <button
                            onClick={() => {
                              onRemoveFarmAccess(access.id)
                              startTransition(() => router.refresh())
                            }}
                            className="text-[11px] font-medium rounded px-2 py-0.5"
                            style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}
                          >
                            Retirer
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onAddFarmAccess(user.id, farm.id)
                              startTransition(() => router.refresh())
                            }}
                            className="text-[11px] font-medium rounded px-2 py-0.5"
                            style={{ color: '#166534', backgroundColor: '#DCFCE7' }}
                          >
                            Ajouter
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Réinitialisation mot de passe */}
          <div>
            <label style={labelStyle}>Réinitialiser le mot de passe</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe (min 6 car.)"
                className="flex-1 rounded-lg text-[13px]"
                style={{
                  padding: '8px 12px',
                  border: '1px solid #D8E0D9',
                  backgroundColor: '#fff',
                  color: '#2C3E2D',
                }}
              />
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
                className="rounded-lg text-[12px] font-medium"
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#F3F4F6',
                  color: '#4B5563',
                  opacity: !newPassword || newPassword.length < 6 ? 0.5 : 1,
                }}
              >
                Réinitialiser
              </button>
            </div>
            {passwordMsg && (
              <p
                className="text-[12px] mt-1"
                style={{ color: passwordMsg.includes('Erreur') ? '#BC6C25' : '#166534' }}
              >
                {passwordMsg}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg text-[13px] font-medium"
            style={{ padding: '8px 16px', color: '#4B5563', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  )
}
