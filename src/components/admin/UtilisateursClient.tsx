'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UserWithRelations, OrgWithFarms } from '@/app/[orgSlug]/(dashboard)/admin/utilisateurs/actions'
import {
  createUser,
  deleteUser,
  updateMembership,
  addFarmAccess,
  removeFarmAccess,
  resetPassword,
} from '@/app/[orgSlug]/(dashboard)/admin/utilisateurs/actions'
import type { MembershipRole } from '@/lib/types'
import UserCreateSlideOver from './UserCreateSlideOver'
import UserEditSlideOver from './UserEditSlideOver'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const ROLE_BADGES: Record<MembershipRole, { bg: string; text: string }> = {
  owner:  { bg: '#F3E8FF', text: '#7E22CE' },
  admin:  { bg: '#DBEAFE', text: '#1E40AF' },
  member: { bg: '#DCFCE7', text: '#166534' },
}

export default function UtilisateursClient({
  initialUsers,
  orgsWithFarms,
}: {
  initialUsers: UserWithRelations[]
  orgsWithFarms: OrgWithFarms[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<UserWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setUsers(initialUsers) }, [initialUsers])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const filtered = users.filter(u =>
    normalize(u.email).includes(normalize(search))
  )

  async function handleCreate(formData: FormData) {
    setError(null)
    const result = await createUser(formData)
    if ('error' in result) {
      setError(result.error)
      return result
    }
    setCreateOpen(false)
    startTransition(() => router.refresh())
    return result
  }

  async function handleUpdateRole(membershipId: string, role: MembershipRole) {
    setError(null)
    const result = await updateMembership(membershipId, role)
    if ('error' in result) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  async function handleAddFarmAccess(userId: string, farmId: string) {
    setError(null)
    const result = await addFarmAccess(userId, farmId)
    if ('error' in result) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  async function handleRemoveFarmAccess(farmAccessId: string) {
    setError(null)
    const result = await removeFarmAccess(farmAccessId)
    if ('error' in result) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  async function handleResetPassword(userId: string, newPassword: string) {
    setError(null)
    const result = await resetPassword(userId, newPassword)
    if ('error' in result) { setError(result.error); return result }
    return result
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setPendingId(id)
    setError(null)
    const result = await deleteUser(id)
    setPendingId(null)
    setConfirmDeleteId(null)
    if ('error' in result) { setError(result.error); return }
    startTransition(() => router.refresh())
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-semibold" style={{ color: '#2C3E2D' }}>
          Utilisateurs
        </h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white"
          style={{ padding: '8px 16px', backgroundColor: '#DC2626' }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
          Nouvel utilisateur
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg text-[13px]"
          style={{
            padding: '8px 12px',
            border: '1px solid #D8E0D9',
            backgroundColor: '#fff',
            color: '#2C3E2D',
            width: '300px',
          }}
        />
      </div>

      {/* Erreur */}
      {error && (
        <div
          className="mb-4 rounded-lg text-[13px]"
          style={{ padding: '10px 14px', backgroundColor: '#FDF3E8', color: '#BC6C25' }}
        >
          {error}
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <table className="w-full text-[13px]" style={{ color: '#2C3E2D' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th className="text-left font-medium px-4 py-3">Email</th>
              <th className="text-left font-medium px-4 py-3">Organisations</th>
              <th className="text-left font-medium px-4 py-3">Fermes accessibles</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#9CA3AF' }}>
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            )}
            {filtered.map(user => (
              <tr
                key={user.id}
                className="border-t"
                style={{ borderColor: '#F3F4F6', transition: 'background-color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
              >
                <td className="px-4 py-3 font-medium">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {user.memberships.map(m => {
                      const badge = ROLE_BADGES[m.role]
                      return (
                        <span
                          key={m.id}
                          className="rounded-full text-[11px] font-medium"
                          style={{
                            padding: '2px 10px',
                            backgroundColor: badge.bg,
                            color: badge.text,
                          }}
                        >
                          {m.organization_name} ({m.role})
                        </span>
                      )
                    })}
                    {user.memberships.length === 0 && (
                      <span style={{ color: '#9CA3AF' }}>Aucune</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {user.farmAccess.map(fa => (
                      <span
                        key={fa.id}
                        className="rounded-full text-[11px] font-medium"
                        style={{
                          padding: '2px 10px',
                          backgroundColor: '#F3F4F6',
                          color: '#4B5563',
                        }}
                      >
                        {fa.farm_name}
                      </span>
                    ))}
                    {user.farmAccess.length === 0 && user.memberships.some(m => m.role !== 'member') && (
                      <span className="text-[11px]" style={{ color: '#9CA3AF' }}>Toutes (owner/admin)</span>
                    )}
                    {user.farmAccess.length === 0 && user.memberships.every(m => m.role === 'member') && (
                      <span style={{ color: '#9CA3AF' }}>Aucune</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditing(user)}
                      className="text-[12px] font-medium rounded px-2.5 py-1"
                      style={{ color: '#4B5563', backgroundColor: '#F3F4F6' }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={pendingId === user.id}
                      className="text-[12px] font-medium rounded px-2.5 py-1"
                      style={{
                        color: confirmDeleteId === user.id ? '#fff' : '#DC2626',
                        backgroundColor: confirmDeleteId === user.id ? '#DC2626' : '#FEF2F2',
                        opacity: pendingId === user.id ? 0.6 : 1,
                      }}
                    >
                      {confirmDeleteId === user.id ? 'Confirmer' : 'Supprimer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slide-over création */}
      <UserCreateSlideOver
        open={createOpen}
        orgsWithFarms={orgsWithFarms}
        onClose={() => { setCreateOpen(false); setError(null) }}
        onSubmit={handleCreate}
        onSuccess={() => startTransition(() => router.refresh())}
      />

      {/* Slide-over édition */}
      <UserEditSlideOver
        open={!!editing}
        user={editing}
        orgsWithFarms={orgsWithFarms}
        onClose={() => { setEditing(null); setError(null) }}
        onUpdateRole={handleUpdateRole}
        onAddFarmAccess={handleAddFarmAccess}
        onRemoveFarmAccess={handleRemoveFarmAccess}
        onResetPassword={handleResetPassword}
      />
    </div>
  )
}
