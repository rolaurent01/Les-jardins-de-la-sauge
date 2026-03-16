'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ExternalMaterial } from '@/lib/types'
import { archiveMaterial, restoreMaterial, createMaterial, updateMaterial } from '@/app/[orgSlug]/(dashboard)/referentiel/materiaux/actions'
import MaterielSlideOver from './MaterielSlideOver'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

export default function MateriauxClient({ initialMaterials }: { initialMaterials: ExternalMaterial[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [materials, setMaterials] = useState(initialMaterials)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<ExternalMaterial | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  /* Sync quand Next.js re-fetche */
  useEffect(() => { setMaterials(initialMaterials) }, [initialMaterials])

  /* Auto-reset de la confirmation d'archivage */
  useEffect(() => {
    if (!confirmArchiveId) return
    const t = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmArchiveId])

  const active   = materials.filter(m => !m.deleted_at)
  const archived = materials.filter(m => !!m.deleted_at)

  const displayed = (showArchived ? archived : active).filter(m => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(m.nom).includes(q) ||
      normalize(m.unite).includes(q) ||
      (m.notes && normalize(m.notes).includes(q))
    )
  })

  function openCreate() {
    setEditingMaterial(null)
    setSlideOverOpen(true)
  }

  function openEdit(m: ExternalMaterial) {
    setEditingMaterial(m)
    setSlideOverOpen(true)
  }

  async function handleSave(fd: FormData) {
    if (editingMaterial) return updateMaterial(editingMaterial.id, fd)
    return createMaterial(fd)
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  function handleArchiveClick(id: string) {
    if (confirmArchiveId === id) {
      setConfirmArchiveId(null)
      setPendingId(id)
      startTransition(async () => {
        await archiveMaterial(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmArchiveId(id)
    }
  }

  function handleRestore(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await restoreMaterial(id)
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Produits complémentaires
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} matériau{active.length !== 1 ? 'x' : ''} actif{active.length !== 1 ? 's' : ''}
            {archived.length > 0 && (
              <> · {archived.length} archivé{archived.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">＋</span>
          Nouveau matériau
        </button>
      </div>

      {/* Barre de recherche + toggle archivés */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom, unité…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e  => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e   => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border"
            style={{
              borderColor: showArchived ? 'var(--color-primary)' : '#D8E0D9',
              backgroundColor: showArchived ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)' : 'transparent',
              color: showArchived ? 'var(--color-primary)' : '#9CA89D',
            }}
          >
            {showArchived ? '← Actifs' : `Archivés (${archived.length})`}
          </button>
        )}
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">⚗️</div>
          <p className="text-sm">
            {search
              ? 'Aucun matériau ne correspond à la recherche.'
              : showArchived
              ? 'Aucun matériau archivé.'
              : 'Aucun matériau. Commencez par en ajouter un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Nom</Th>
                <Th>Unité</Th>
                <Th>Notes</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((m, i) => {
                const isArchived   = !!m.deleted_at
                const isPending    = pendingId === m.id
                const isConfirming = confirmArchiveId === m.id

                return (
                  <tr
                    key={m.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isArchived || isPending ? 0.5 : 1,
                    }}
                  >
                    {/* Nom */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {m.nom}
                    </td>

                    {/* Unité */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#F5F2ED', color: '#6B7B6C' }}
                      >
                        {m.unite}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: '#6B7B6C' }}>
                      {m.notes ?? <Dash />}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isArchived ? (
                          <button
                            onClick={() => handleRestore(m.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg text-xs border"
                            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(m.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#BC6C25', color: '#FFF' }}
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmArchiveId(null)}
                              className="px-2.5 py-1 rounded-lg text-xs border"
                              style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(m)}
                              className="p-1.5 rounded-lg"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleArchiveClick(m.id)}
                              className="p-1.5 rounded-lg"
                              title="Archiver"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#BC6C25')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              🗄️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over */}
      <MaterielSlideOver
        key={editingMaterial?.id ?? 'new-material'}
        open={slideOverOpen}
        material={editingMaterial}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */
function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}
