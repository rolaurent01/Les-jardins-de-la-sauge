'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RowCareWithRelations, RowWithParcel, Variety } from '@/lib/types'
import { createRowCare, updateRowCare, deleteRowCare } from '@/app/[orgSlug]/(dashboard)/parcelles/suivi-rang/actions'
import SuiviRangSlideOver from './SuiviRangSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { formatDate, formatDuration } from '@/lib/utils/format'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

/** Construit le label "Site — Parcelle — Rang N" */
function rowLabel(care: RowCareWithRelations): string {
  const r = care.rows
  if (!r) return '—'
  const parcel = r.parcels as { nom?: string; code?: string; sites?: { nom?: string } | null } | null
  if (!parcel) return `Rang ${r.numero}`
  const site = parcel.sites
  const sitePart = site?.nom ? `${site.nom} — ` : ''
  return `${sitePart}${parcel.nom} — Rang ${r.numero}`
}

/** Badge colore selon le type de soin */
function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    desherbage: { label: 'Desherbage', bg: '#DCFCE7', color: '#166534' },
    paillage:   { label: 'Paillage',   bg: '#FEF3C7', color: '#92400E' },
    arrosage:   { label: 'Arrosage',   bg: '#DBEAFE', color: '#1E40AF' },
    autre:      { label: 'Autre',      bg: '#F3F4F6', color: '#6B7280' },
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
  initialRowCare: RowCareWithRelations[]
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
}

const SUIVI_RANG_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string })?.nom_vernaculaire ?? '' },
  { key: '_rang', label: 'Rang' },
  { key: 'date', label: 'Date' },
  { key: 'type_soin', label: 'Type soin' },
  { key: 'temps_min', label: 'Temps (min)' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function SuiviRangClient({ initialRowCare, rows, varieties }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [rowCareList, setRowCareList] = useState(initialRowCare)
  const [search, setSearch] = useState('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingCare, setEditingCare] = useState<RowCareWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    setRowCareList(initialRowCare)
  }, [initialRowCare])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const displayed = rowCareList.filter(c => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (c.varieties?.nom_vernaculaire && normalize(c.varieties.nom_vernaculaire).includes(q)) ||
      normalize(rowLabel(c)).includes(q) ||
      (c.commentaire && normalize(c.commentaire).includes(q)) ||
      (c.type_soin && normalize(c.type_soin).includes(q))
    )
  })

  function openCreate() {
    setEditingCare(null)
    setSlideOverOpen(true)
  }

  function openEdit(care: RowCareWithRelations) {
    setEditingCare(care)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingCare) return updateRowCare(editingCare.id, formData)
    return createRowCare(formData)
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
        await deleteRowCare(id)
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
            Suivi de rang
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {rowCareList.length} enregistrement{rowCareList.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed.map(c => ({ ...c, _rang: rowLabel(c) })) as unknown as Record<string, unknown>[]}
            columns={SUIVI_RANG_EXPORT_COLUMNS}
            filename="suivi_rang"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">+</span>
            Nouveau soin
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
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
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm">
            {search
              ? 'Aucun soin ne correspond a la recherche.'
              : 'Aucun suivi de rang. Commencez par en creer un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Variete</Th>
                <Th>Rang</Th>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Temps</Th>
                <Th>Commentaire</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, i) => {
                const isDeleting  = pendingId === c.id
                const isConfirming = confirmDeleteId === c.id

                return (
                  <tr
                    key={c.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isDeleting ? 0.4 : 1,
                    }}
                  >
                    {/* Variete */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {c.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>

                    {/* Rang */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {rowLabel(c)}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(c.date)}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={c.type_soin} />
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(c.temps_min)}
                    </td>

                    {/* Commentaire */}
                    <td
                      className="px-4 py-3 max-w-[200px] truncate"
                      style={{ color: '#6B7B6C' }}
                      title={c.commentaire ?? undefined}
                    >
                      {c.commentaire ?? <Dash />}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(c.id)}
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
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(c.id)}
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
      <SuiviRangSlideOver
        key={editingCare?.id ?? 'new'}
        open={slideOverOpen}
        rowCare={editingCare}
        rows={rows}
        varieties={varieties}
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
