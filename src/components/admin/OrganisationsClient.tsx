'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrganizationWithCounts } from '@/app/[orgSlug]/(dashboard)/admin/organisations/actions'
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  uploadOrganizationLogo,
} from '@/app/[orgSlug]/(dashboard)/admin/organisations/actions'
import type { Organization } from '@/lib/types'
import OrganisationSlideOver from './OrganisationSlideOver'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const PLAN_BADGES: Record<string, { bg: string; text: string }> = {
  starter:    { bg: '#DCFCE7', text: '#166534' },
  pro:        { bg: '#DBEAFE', text: '#1E40AF' },
  enterprise: { bg: '#F3E8FF', text: '#7E22CE' },
}

export default function OrganisationsClient({
  initialOrganizations,
}: {
  initialOrganizations: OrganizationWithCounts[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [search, setSearch] = useState('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editing, setEditing] = useState<OrganizationWithCounts | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setOrganizations(initialOrganizations) }, [initialOrganizations])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const filtered = organizations.filter(o =>
    normalize(o.nom).includes(normalize(search)) ||
    normalize(o.slug).includes(normalize(search))
  )

  function openCreate() {
    setEditing(null)
    setSlideOverOpen(true)
  }

  function openEdit(org: OrganizationWithCounts) {
    setEditing(org)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    setError(null)
    const result = editing
      ? await updateOrganization(editing.id, formData)
      : await createOrganization(formData)

    if ('error' in result) {
      setError(result.error)
      return result
    }

    setSlideOverOpen(false)
    startTransition(() => router.refresh())
    return result
  }

  async function handleLogoUpload(orgId: string, formData: FormData) {
    const result = await uploadOrganizationLogo(orgId, formData)
    if ('error' in result) {
      setError(result.error)
      return result
    }
    startTransition(() => router.refresh())
    return result
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setPendingId(id)
    setError(null)
    const result = await deleteOrganization(id)
    setPendingId(null)
    setConfirmDeleteId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-semibold" style={{ color: '#2C3E2D' }}>
          Organisations
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white"
          style={{ padding: '8px 16px', backgroundColor: '#DC2626' }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
          Nouvelle organisation
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher une organisation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg text-[13px]"
          style={{
            padding: '8px 12px',
            border: '1px solid #D8E0D9',
            backgroundColor: '#fff',
            color: '#2C3E2D',
          }}
        />
      </div>

      {/* Message d'erreur global */}
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
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-4 py-3">Slug</th>
              <th className="text-left font-medium px-4 py-3">Plan</th>
              <th className="text-center font-medium px-4 py-3">Fermes</th>
              <th className="text-center font-medium px-4 py-3">Utilisateurs</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#9CA3AF' }}>
                  Aucune organisation trouvée.
                </td>
              </tr>
            )}
            {filtered.map(org => {
              const planStyle = PLAN_BADGES[org.plan] ?? PLAN_BADGES.starter
              return (
                <tr
                  key={org.id}
                  className="border-t"
                  style={{ borderColor: '#F3F4F6' }}
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {org.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={org.logo_url}
                          alt={org.nom}
                          className="w-6 h-6 rounded object-contain flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: org.couleur_primaire }}
                        >
                          {org.nom.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{org.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#6B7280' }}>{org.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full text-[11px] font-medium"
                      style={{
                        padding: '2px 10px',
                        backgroundColor: planStyle.bg,
                        color: planStyle.text,
                      }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{org.farmsCount} / {org.max_farms}</td>
                  <td className="px-4 py-3 text-center">{org.usersCount} / {org.max_users}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(org)}
                        className="text-[12px] font-medium rounded px-2.5 py-1"
                        style={{ color: '#4B5563', backgroundColor: '#F3F4F6' }}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(org.id)}
                        disabled={pendingId === org.id}
                        className="text-[12px] font-medium rounded px-2.5 py-1"
                        style={{
                          color: confirmDeleteId === org.id ? '#fff' : '#DC2626',
                          backgroundColor: confirmDeleteId === org.id ? '#DC2626' : '#FEF2F2',
                          opacity: pendingId === org.id ? 0.6 : 1,
                        }}
                      >
                        {confirmDeleteId === org.id ? 'Confirmer' : 'Supprimer'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      <OrganisationSlideOver
        open={slideOverOpen}
        item={editing}
        onClose={() => { setSlideOverOpen(false); setError(null) }}
        onSubmit={handleSave}
        onLogoUpload={handleLogoUpload}
        onSuccess={() => startTransition(() => router.refresh())}
      />
    </div>
  )
}
