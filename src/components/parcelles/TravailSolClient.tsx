'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SoilWorkWithRelations, RowWithParcel } from '@/lib/types'
import { createSoilWork, updateSoilWork, deleteSoilWork } from '@/app/(dashboard)/parcelles/travail-sol/actions'
import TravailSolSlideOver from './TravailSolSlideOver'
import { formatDate, formatDuration } from '@/lib/utils/format'

/* Normalise une chaîne pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Construit le label "Site — Parcelle — Rang N" */
function rowLabel(work: SoilWorkWithRelations): string {
  const r = work.rows
  if (!r) return '—'
  const parcel = r.parcels
  if (!parcel) return `Rang ${r.numero}`
  const site = (parcel as { sites?: { nom?: string } | null }).sites
  const sitePart = site?.nom ? `${site.nom} — ` : ''
  return `${sitePart}${parcel.nom} — Rang ${r.numero}`
}

/** Badge coloré selon le type de travail */
function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    depaillage:  { label: 'Dépaillage',  bg: '#FEF3C7', color: '#92400E' },
    motoculteur: { label: 'Motoculteur', bg: '#DBEAFE', color: '#1E40AF' },
    amendement:  { label: 'Amendement',  bg: '#DCFCE7', color: '#166534' },
    autre:       { label: 'Autre',       bg: '#F3F4F6', color: '#6B7280' },
  }
  const style = map[type ?? ''] ?? map.autre
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

type Props = {
  initialSoilWorks: SoilWorkWithRelations[]
  rows: RowWithParcel[]
}

export default function TravailSolClient({ initialSoilWorks, rows }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [soilWorks, setSoilWorks] = useState(initialSoilWorks)
  const [search, setSearch] = useState('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingWork, setEditingWork] = useState<SoilWorkWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    setSoilWorks(initialSoilWorks)
  }, [initialSoilWorks])

  /* Auto-annulation de la confirmation de suppression après 4 secondes */
  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const displayed = soilWorks.filter(w => {
    if (!search.trim()) return true
    const q = normalize(search)
    const r = w.rows
    const parcel = r?.parcels as { nom?: string; code?: string; sites?: { nom?: string } | null } | null
    return (
      normalize(rowLabel(w)).includes(q) ||
      (r && normalize(r.numero).includes(q)) ||
      (parcel?.code && normalize(parcel.code).includes(q)) ||
      (w.type_travail && normalize(w.type_travail).includes(q)) ||
      (w.detail && normalize(w.detail).includes(q))
    )
  })

  function openCreate() {
    setEditingWork(null)
    setSlideOverOpen(true)
  }

  function openEdit(work: SoilWorkWithRelations) {
    setEditingWork(work)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingWork) return updateSoilWork(editingWork.id, formData)
    return createSoilWork(formData)
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
        await deleteSoilWork(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div className="p-8">
      {/* ---- En-tête ---- */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Travail de sol
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {soilWorks.length} enregistrement{soilWorks.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ backgroundColor: '#3A5A40', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">＋</span>
          Nouveau travail
        </button>
      </div>

      {/* ---- Barre de recherche ---- */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#9CA89D' }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par rang, type, détail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = '#3A5A40')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>
      </div>

      {/* ---- Tableau ---- */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm">
            {search
              ? 'Aucun travail ne correspond à la recherche.'
              : 'Aucun travail de sol. Commencez par en créer un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Date</Th>
                <Th>Rang</Th>
                <Th>Type</Th>
                <Th>Détail</Th>
                <Th>Temps</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((w, i) => {
                const isPending    = pendingId === w.id
                const isConfirming = confirmDeleteId === w.id

                return (
                  <tr
                    key={w.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isPending ? 0.4 : 1,
                    }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(w.date)}
                    </td>

                    {/* Rang */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {rowLabel(w)}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={w.type_travail} />
                    </td>

                    {/* Détail */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {w.detail ?? <Dash />}
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(w.temps_min)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(w.id)}
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
                              onClick={() => openEdit(w)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#3A5A40')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(w.id)}
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

      {/* ---- Slide-over ---- */}
      <TravailSolSlideOver
        key={editingWork?.id ?? 'new'}
        open={slideOverOpen}
        soilWork={editingWork}
        rows={rows}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
      style={{ color: '#9CA89D', textAlign: align }}
    >
      {children}
    </th>
  )
}

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}
