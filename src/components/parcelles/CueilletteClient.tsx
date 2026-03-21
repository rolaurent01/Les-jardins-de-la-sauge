'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { HarvestWithRelations, RowWithParcel, RowPlantingInfo, Variety, PartiePlante } from '@/lib/types'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import { PARTIE_COLORS } from '@/lib/utils/colors'
import {
  createHarvest,
  updateHarvest,
  archiveHarvest,
  restoreHarvest,
} from '@/app/[orgSlug]/(dashboard)/parcelles/cueillette/actions'
import CueilletteSlideOver from './CueilletteSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { formatDate, formatDuration } from '@/lib/utils/format'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

/** Formate un poids en g ou kg */
function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  return `${g} g`
}

/** Construit le label du lieu selon le type de cueillette */
function lieuLabel(h: HarvestWithRelations): string {
  if (h.type_cueillette === 'sauvage') return h.lieu_sauvage ?? '—'
  const r = h.rows
  if (!r) return '—'
  const parcel = r.parcels as { nom?: string } | null
  if (!parcel) return `Rang ${r.numero}`
  return `${parcel.nom} — Rang ${r.numero}`
}


type TypeFilter = 'all' | 'parcelle' | 'sauvage'

type Props = {
  initialHarvests: HarvestWithRelations[]
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  lieuxSauvages: string[]
  rowPlantings: RowPlantingInfo[]
}

const CUEILLETTE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'type_cueillette', label: 'Type', format: (v) => v === 'parcelle' ? 'Parcelle' : 'Sauvage' },
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string })?.nom_vernaculaire ?? '' },
  { key: 'partie_plante', label: 'Partie plante' },
  { key: '_lieu', label: 'Lieu' },
  { key: 'date', label: 'Date' },
  { key: 'poids_g', label: 'Poids (g)' },
  { key: 'temps_min', label: 'Temps (min)' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function CueilletteClient({ initialHarvests, rows, varieties, lieuxSauvages, rowPlantings }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [harvests, setHarvests] = useState(initialHarvests)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingHarvest, setEditingHarvest] = useState<HarvestWithRelations | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setHarvests(initialHarvests) }, [initialHarvests])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active = harvests.filter(h => !h.deleted_at)
  const archived = harvests.filter(h => !!h.deleted_at)

  const displayed = (showArchived ? archived : active).filter(h => {
    const matchType = typeFilter === 'all' || h.type_cueillette === typeFilter
    if (!matchType) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (h.varieties?.nom_vernaculaire && normalize(h.varieties.nom_vernaculaire).includes(q)) ||
      normalize(lieuLabel(h)).includes(q) ||
      (h.commentaire && normalize(h.commentaire).includes(q)) ||
      (h.lieu_sauvage && normalize(h.lieu_sauvage).includes(q))
    )
  })

  function openCreate() {
    setEditingHarvest(null)
    setSlideOverOpen(true)
  }

  function openEdit(h: HarvestWithRelations) {
    setEditingHarvest(h)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingHarvest) return updateHarvest(editingHarvest.id, formData)
    return createHarvest(formData)
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
        await archiveHarvest(id)
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
      await restoreHarvest(id)
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Cueillette
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} enregistrement{active.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed.map(h => ({ ...h, _lieu: lieuLabel(h) })) as unknown as Record<string, unknown>[]}
            columns={CUEILLETTE_EXPORT_COLUMNS}
            filename="cueillettes"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">+</span>
            Nouvelle cueillette
          </button>
        </div>
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
            placeholder="Rechercher par variete, lieu, commentaire…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtres type */}
        <div className="flex gap-1">
          {([
            { value: 'all', label: 'Tous' },
            { value: 'parcelle', label: '🌿 Parcelle' },
            { value: 'sauvage', label: '🌾 Sauvage' },
          ] as { value: TypeFilter; label: string }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: typeFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color: typeFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                border: typeFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Toggle archives */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: showArchived ? '#FEF3C7' : 'transparent',
            color: showArchived ? '#92400E' : '#9CA89D',
            border: `1px solid ${showArchived ? '#F59E0B44' : '#D8E0D9'}`,
          }}
        >
          {showArchived ? `Archives (${archived.length})` : 'Voir archives'}
        </button>
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm">
            {search || typeFilter !== 'all'
              ? 'Aucune cueillette ne correspond aux filtres.'
              : showArchived
                ? 'Aucune cueillette archivee.'
                : 'Aucune cueillette. Commencez par en creer une.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Type</Th>
                <Th>Variete</Th>
                <Th>Partie</Th>
                <Th>Lieu</Th>
                <Th>Date</Th>
                <Th>Poids</Th>
                <Th>Temps</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((h, i) => {
                const isArchiving = pendingId === h.id
                const isConfirming = confirmArchiveId === h.id
                const partie = h.partie_plante as PartiePlante
                const partieStyle = PARTIE_COLORS[partie] ?? PARTIE_COLORS.plante_entiere

                return (
                  <tr
                    key={h.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isArchiving ? 0.4 : 1,
                    }}
                  >
                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={h.type_cueillette} />
                    </td>

                    {/* Variete */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {h.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>

                    {/* Partie */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: partieStyle.bg, color: partieStyle.color }}
                      >
                        {PARTIE_PLANTE_LABELS[partie] ?? partie}
                      </span>
                    </td>

                    {/* Lieu */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {lieuLabel(h)}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(h.date)}
                    </td>

                    {/* Poids */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#2C3E2D' }}>
                      {formatWeight(h.poids_g)}
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(h.temps_min)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {showArchived ? (
                          <button
                            onClick={() => handleRestore(h.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(h.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#DC2626', color: '#FFF' }}
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
                              onClick={() => openEdit(h)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleArchiveClick(h.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Archiver"
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
      <CueilletteSlideOver
        key={editingHarvest?.id ?? 'new'}
        open={slideOverOpen}
        harvest={editingHarvest}
        rows={rows}
        varieties={varieties}
        rowPlantings={rowPlantings}
        lieuxSauvages={lieuxSauvages}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */

function TypeBadge({ type }: { type: 'parcelle' | 'sauvage' }) {
  const styles = {
    parcelle: { label: '🌿 Parcelle', bg: '#DCFCE7', color: '#166534' },
    sauvage:  { label: '🌾 Sauvage',  bg: '#FEF3C7', color: '#92400E' },
  }
  const s = styles[type]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}
