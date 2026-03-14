'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FarmWithRelations, FarmModule } from '@/app/[orgSlug]/(dashboard)/admin/fermes/actions'
import {
  createFarm,
  updateFarm,
  deleteFarm,
  toggleModule,
} from '@/app/[orgSlug]/(dashboard)/admin/fermes/actions'
import type { Organization } from '@/lib/types'
import FermeSlideOver from './FermeSlideOver'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const MODULE_BADGES: Record<FarmModule, { bg: string; text: string; label: string }> = {
  pam:        { bg: '#DCFCE7', text: '#166534', label: 'PAM' },
  apiculture: { bg: '#FEF3C7', text: '#92400E', label: 'Apiculture' },
  maraichage: { bg: '#DBEAFE', text: '#1E40AF', label: 'Maraîchage' },
}

export default function FermesClient({
  initialFarms,
  organizations,
}: {
  initialFarms: FarmWithRelations[]
  organizations: Pick<Organization, 'id' | 'nom' | 'max_farms'>[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [farms, setFarms] = useState(initialFarms)
  const [search, setSearch] = useState('')
  const [filterOrgId, setFilterOrgId] = useState<string>('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editing, setEditing] = useState<FarmWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setFarms(initialFarms) }, [initialFarms])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const filtered = farms.filter(f => {
    const matchSearch = normalize(f.nom).includes(normalize(search)) ||
      normalize(f.organization.nom).includes(normalize(search))
    const matchOrg = !filterOrgId || f.organization.id === filterOrgId
    return matchSearch && matchOrg
  })

  function openCreate() {
    setEditing(null)
    setSlideOverOpen(true)
  }

  function openEdit(farm: FarmWithRelations) {
    setEditing(farm)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    setError(null)
    const result = editing
      ? await updateFarm(editing.id, formData)
      : await createFarm(formData)

    if ('error' in result) {
      setError(result.error)
      return result
    }

    setSlideOverOpen(false)
    startTransition(() => router.refresh())
    return result
  }

  async function handleToggleModule(farmId: string, module: FarmModule) {
    setError(null)
    const result = await toggleModule(farmId, module)
    if ('error' in result) {
      setError(result.error)
      return
    }
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setPendingId(id)
    setError(null)
    const result = await deleteFarm(id)
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
          Fermes
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white"
          style={{ padding: '8px 16px', backgroundColor: '#DC2626' }}
        >
          <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
          Nouvelle ferme
        </button>
      </div>

      {/* Recherche + filtre */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher une ferme..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg text-[13px]"
          style={{
            padding: '8px 12px',
            border: '1px solid #D8E0D9',
            backgroundColor: '#fff',
            color: '#2C3E2D',
            width: '240px',
          }}
        />
        <select
          value={filterOrgId}
          onChange={e => setFilterOrgId(e.target.value)}
          className="rounded-lg text-[13px]"
          style={{
            padding: '8px 12px',
            border: '1px solid #D8E0D9',
            backgroundColor: '#fff',
            color: '#2C3E2D',
          }}
        >
          <option value="">Toutes les organisations</option>
          {organizations.map(o => (
            <option key={o.id} value={o.id}>{o.nom}</option>
          ))}
        </select>
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
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-4 py-3">Organisation</th>
              <th className="text-left font-medium px-4 py-3">Slug</th>
              <th className="text-left font-medium px-4 py-3">Modules</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#9CA3AF' }}>
                  Aucune ferme trouvée.
                </td>
              </tr>
            )}
            {filtered.map(farm => (
              <tr key={farm.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                <td className="px-4 py-3 font-medium">
                  {farm.nom}
                  {farm.certif_bio && (
                    <span
                      className="ml-2 inline-block rounded-full text-[10px] font-semibold"
                      style={{ padding: '1px 8px', backgroundColor: '#DCFCE7', color: '#166534' }}
                    >
                      Bio
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: '#6B7280' }}>{farm.organization.nom}</td>
                <td className="px-4 py-3" style={{ color: '#6B7280' }}>{farm.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {(['pam', 'apiculture', 'maraichage'] as FarmModule[]).map(mod => {
                      const isActive = farm.modules.includes(mod)
                      const badge = MODULE_BADGES[mod]
                      return (
                        <button
                          key={mod}
                          onClick={() => handleToggleModule(farm.id, mod)}
                          className="rounded-full text-[11px] font-medium"
                          style={{
                            padding: '2px 10px',
                            backgroundColor: isActive ? badge.bg : '#F3F4F6',
                            color: isActive ? badge.text : '#9CA3AF',
                            border: isActive ? 'none' : '1px dashed #D1D5DB',
                            cursor: 'pointer',
                            transition: 'all 150ms ease-out',
                          }}
                        >
                          {badge.label}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(farm)}
                      className="text-[12px] font-medium rounded px-2.5 py-1"
                      style={{ color: '#4B5563', backgroundColor: '#F3F4F6' }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(farm.id)}
                      disabled={pendingId === farm.id}
                      className="text-[12px] font-medium rounded px-2.5 py-1"
                      style={{
                        color: confirmDeleteId === farm.id ? '#fff' : '#DC2626',
                        backgroundColor: confirmDeleteId === farm.id ? '#DC2626' : '#FEF2F2',
                        opacity: pendingId === farm.id ? 0.6 : 1,
                      }}
                    >
                      {confirmDeleteId === farm.id ? 'Confirmer' : 'Supprimer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      <FermeSlideOver
        open={slideOverOpen}
        item={editing}
        organizations={organizations}
        onClose={() => { setSlideOverOpen(false); setError(null) }}
        onSubmit={handleSave}
        onSuccess={() => startTransition(() => router.refresh())}
      />
    </div>
  )
}
