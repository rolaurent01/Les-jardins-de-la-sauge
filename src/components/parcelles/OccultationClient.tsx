'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OccultationWithRelations, RowWithParcel, MethodeOccultation } from '@/lib/types'
import {
  createOccultation,
  updateOccultation,
  deleteOccultation,
} from '@/app/[orgSlug]/(dashboard)/parcelles/occultation/actions'
import OccultationSlideOver from './OccultationSlideOver'
import { formatDate, formatDuration } from '@/lib/utils/format'

/** Normalise une chaine pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Construit le label du rang : "Site — Parcelle -> Rang N" */
function rowLabel(o: OccultationWithRelations): string {
  const r = o.rows
  if (!r) return '—'
  const parcel = r.parcels
  const siteName = parcel?.sites?.nom
  const parcelName = parcel?.nom
  if (siteName && parcelName) return `${siteName} — ${parcelName} -> Rang ${r.numero}`
  if (parcelName) return `${parcelName} -> Rang ${r.numero}`
  return `Rang ${r.numero}`
}

const METHODE_LABELS: Record<MethodeOccultation, string> = {
  paille: 'Paille',
  foin: 'Foin',
  bache: 'Bache',
  engrais_vert: 'Engrais vert',
}

const METHODE_COLORS: Record<MethodeOccultation, { bg: string; color: string }> = {
  paille: { bg: '#FEF3C7', color: '#92400E' },
  foin: { bg: '#F5E6D3', color: '#78350F' },
  bache: { bg: '#F3F4F6', color: '#374151' },
  engrais_vert: { bg: '#DCFCE7', color: '#166534' },
}

/** Resume adaptatif selon la methode */
function detailSummary(o: OccultationWithRelations): string {
  switch (o.methode) {
    case 'paille':
      return o.fournisseur ? `Fournisseur : ${o.fournisseur}` : '—'
    case 'foin':
      return o.fournisseur ? `Fournisseur : ${o.fournisseur}` : '—'
    case 'bache':
      return o.temps_retrait_min ? `Retrait : ${formatDuration(o.temps_retrait_min)}` : '—'
    case 'engrais_vert':
      return o.engrais_vert_nom ?? '—'
    default:
      return '—'
  }
}

const ALL_METHODES: MethodeOccultation[] = ['paille', 'foin', 'bache', 'engrais_vert']

type Props = {
  initialOccultations: OccultationWithRelations[]
  rows: RowWithParcel[]
  engraisVertNoms: string[]
}

export default function OccultationClient({ initialOccultations, rows, engraisVertNoms }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [occultations, setOccultations] = useState(initialOccultations)
  const [search, setSearch] = useState('')
  const [methodeFilter, setMethodeFilter] = useState<MethodeOccultation | null>(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingOccultation, setEditingOccultation] = useState<OccultationWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setOccultations(initialOccultations) }, [initialOccultations])

  // Auto-reset confirmation apres 4s
  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const displayed = occultations.filter(o => {
    // Filtre par methode
    if (methodeFilter && o.methode !== methodeFilter) return false
    // Recherche texte
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(rowLabel(o)).includes(q) ||
      normalize(METHODE_LABELS[o.methode]).includes(q) ||
      (o.fournisseur && normalize(o.fournisseur).includes(q)) ||
      (o.engrais_vert_nom && normalize(o.engrais_vert_nom).includes(q)) ||
      (o.commentaire && normalize(o.commentaire).includes(q))
    )
  })

  function openCreate() {
    setEditingOccultation(null)
    setSlideOverOpen(true)
  }

  function openEdit(o: OccultationWithRelations) {
    setEditingOccultation(o)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingOccultation) return updateOccultation(editingOccultation.id, formData)
    return createOccultation(formData)
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
        await deleteOccultation(id)
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
            Occultation
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {occultations.length} enregistrement{occultations.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">+</span>
          Nouvelle occultation
        </button>
      </div>

      {/* Barre de recherche + filtres */}
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
            placeholder="Rechercher par rang, methode, fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtres par methode */}
        <div className="flex gap-1.5">
          <FilterBtn active={methodeFilter === null} onClick={() => setMethodeFilter(null)}>
            Tous
          </FilterBtn>
          {ALL_METHODES.map(m => (
            <FilterBtn
              key={m}
              active={methodeFilter === m}
              onClick={() => setMethodeFilter(methodeFilter === m ? null : m)}
            >
              {METHODE_LABELS[m]}
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌾</div>
          <p className="text-sm">
            {search || methodeFilter
              ? 'Aucune occultation ne correspond aux criteres.'
              : 'Aucune occultation. Commencez par en creer une.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Rang</Th>
                <Th>Methode</Th>
                <Th>Date debut</Th>
                <Th>Date fin</Th>
                <Th>Detail</Th>
                <Th>Temps</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((o, i) => {
                const isDeleting = pendingId === o.id
                const isConfirming = confirmDeleteId === o.id
                const isEnCours = o.date_fin == null
                const mc = METHODE_COLORS[o.methode]

                return (
                  <tr
                    key={o.id}
                    style={{
                      backgroundColor: isEnCours
                        ? '#F0FDF4'
                        : i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isDeleting ? 0.4 : 1,
                    }}
                  >
                    {/* Rang */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {rowLabel(o)}
                    </td>

                    {/* Methode (badge) */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: mc.bg, color: mc.color }}
                      >
                        {METHODE_LABELS[o.methode]}
                      </span>
                    </td>

                    {/* Date debut */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(o.date_debut)}
                    </td>

                    {/* Date fin */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEnCours ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                        >
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: '#22C55E', animation: 'pulse 2s infinite' }}
                          />
                          En cours
                        </span>
                      ) : (
                        <span style={{ color: '#2C3E2D' }}>{formatDate(o.date_fin)}</span>
                      )}
                    </td>

                    {/* Detail */}
                    <td
                      className="px-4 py-3 max-w-[200px] truncate"
                      style={{ color: '#6B7B6C' }}
                      title={detailSummary(o)}
                    >
                      {detailSummary(o)}
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(o.temps_min)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(o.id)}
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
                              onClick={() => openEdit(o)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(o.id)}
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

      {/* Animation pulse pour le badge "En cours" */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Slide-over */}
      <OccultationSlideOver
        key={editingOccultation?.id ?? 'new'}
        open={slideOverOpen}
        occultation={editingOccultation}
        rows={rows}
        engraisVertNoms={engraisVertNoms}
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

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#6B7B6C',
        border: active ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
      }}
    >
      {children}
    </button>
  )
}
