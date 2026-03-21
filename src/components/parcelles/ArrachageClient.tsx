'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { UprootingWithRelations, RowWithParcel, RowPlantingInfo, Variety } from '@/lib/types'
import {
  createUprooting,
  updateUprooting,
  deleteUprooting,
} from '@/app/[orgSlug]/(dashboard)/parcelles/arrachage/actions'
import ArrachageSlideOver from './ArrachageSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { formatDate, formatDuration } from '@/lib/utils/format'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

/** Construit le label du rang : "Site — Parcelle -> Rang N" */
function rowLabel(u: UprootingWithRelations): string {
  const r = u.rows
  if (!r) return '—'
  const parcel = r.parcels as { nom?: string; code?: string; sites?: { nom?: string } | null } | null
  const siteName = parcel?.sites?.nom
  const parcelName = parcel?.nom
  if (siteName && parcelName) return `${siteName} — ${parcelName} -> Rang ${r.numero}`
  if (parcelName) return `${parcelName} -> Rang ${r.numero}`
  return `Rang ${r.numero}`
}

type Props = {
  initialUprootings: UprootingWithRelations[]
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  rowPlantings: RowPlantingInfo[]
}

const ARRACHAGE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: '_rang', label: 'Rang' },
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string })?.nom_vernaculaire ?? '' },
  { key: 'date', label: 'Date' },
  { key: 'temps_min', label: 'Temps (min)' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function ArrachageClient({ initialUprootings, rows, varieties, rowPlantings }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [uprootings, setUprootings] = useState(initialUprootings)
  const [search, setSearch] = useState('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingUprooting, setEditingUprooting] = useState<UprootingWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setUprootings(initialUprootings) }, [initialUprootings])

  // Auto-reset confirmation apres 4s
  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const displayed = uprootings.filter(u => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (u.varieties?.nom_vernaculaire && normalize(u.varieties.nom_vernaculaire).includes(q)) ||
      normalize(rowLabel(u)).includes(q) ||
      (u.commentaire && normalize(u.commentaire).includes(q))
    )
  })

  function openCreate() {
    setEditingUprooting(null)
    setSlideOverOpen(true)
  }

  function openEdit(u: UprootingWithRelations) {
    setEditingUprooting(u)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingUprooting) return updateUprooting(editingUprooting.id, formData)
    return createUprooting(formData)
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null)
      setPendingId(id)
      startTransition(async () => {
        await deleteUprooting(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Arrachage
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {uprootings.length} enregistrement{uprootings.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed.map(u => ({ ...u, _rang: rowLabel(u) })) as unknown as Record<string, unknown>[]}
            columns={ARRACHAGE_EXPORT_COLUMNS}
            filename="arrachages"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">+</span>
            Nouvel arrachage
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#9CA89D' }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par variete, rang, commentaire…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🪴</div>
          <p className="text-sm">
            {search
              ? 'Aucun arrachage ne correspond a la recherche.'
              : 'Aucun arrachage. Commencez par en creer un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Rang</Th>
                <Th>Variete</Th>
                <Th>Date</Th>
                <Th>Temps</Th>
                <Th>Commentaire</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((u, i) => {
                const isDeleting = pendingId === u.id
                const isConfirming = confirmDeleteId === u.id

                return (
                  <tr
                    key={u.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isDeleting ? 0.4 : 1,
                    }}
                  >
                    {/* Rang */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {rowLabel(u)}
                    </td>

                    {/* Variete */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {u.varieties?.nom_vernaculaire ?? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                        >
                          Tout le rang
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(u.date)}
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(u.temps_min)}
                    </td>

                    {/* Commentaire */}
                    <td
                      className="px-4 py-3 max-w-[200px] truncate"
                      style={{ color: '#6B7B6C' }}
                      title={u.commentaire ?? undefined}
                    >
                      {u.commentaire ?? <Dash />}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(u.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#DC2626', color: '#FFF' }}
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded-lg text-xs border"
                              style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(u.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Supprimer"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              🗑️
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
      <ArrachageSlideOver
        key={editingUprooting?.id ?? 'new'}
        open={slideOverOpen}
        uprooting={editingUprooting}
        rows={rows}
        varieties={varieties}
        rowPlantings={rowPlantings}
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
