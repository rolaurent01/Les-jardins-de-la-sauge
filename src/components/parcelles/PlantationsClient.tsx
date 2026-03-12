'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlantingWithRelations, RowWithParcel, Variety } from '@/lib/types'
import type { SeedlingForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/plantations/actions'
import {
  createPlanting,
  updatePlanting,
  archivePlanting,
  restorePlanting,
} from '@/app/[orgSlug]/(dashboard)/parcelles/plantations/actions'
import PlantationSlideOver from './PlantationSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { formatDate } from '@/lib/utils/format'

/* Normalise une chaîne pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Construit le label "Site — Parcelle — Rang N" */
function rowLabel(p: PlantingWithRelations): string {
  const r = p.rows
  if (!r) return '—'
  const parcel = r.parcels as { nom?: string; code?: string; sites?: { nom?: string } | null } | null
  if (!parcel) return `Rang ${r.numero}`
  const site = parcel.sites
  const sitePart = site?.nom ? `${site.nom} — ` : ''
  return `${sitePart}${parcel.nom} — Rang ${r.numero}`
}

/** Labels affichables pour les types de plant */
const TYPE_PLANT_LABELS: Record<string, string> = {
  godet: 'Godet',
  caissette: 'Caissette',
  mini_motte: 'Mini-motte',
  plant_achete: 'Plant acheté',
  division: 'Division',
  bouture: 'Bouture',
  marcottage: 'Marcottage',
  stolon: 'Stolon',
  rhizome: 'Rhizome',
  semis_direct: 'Semis direct',
}

/** Couleur badge par type de plant */
const TYPE_PLANT_COLORS: Record<string, { bg: string; color: string }> = {
  godet:         { bg: '#DCFCE7', color: '#166534' },
  caissette:     { bg: '#DBEAFE', color: '#1E40AF' },
  mini_motte:    { bg: '#FEF3C7', color: '#92400E' },
  plant_achete:  { bg: '#F3E8FF', color: '#6B21A8' },
  division:      { bg: '#FFEDD5', color: '#9A3412' },
  bouture:       { bg: '#FCE7F3', color: '#9D174D' },
  marcottage:    { bg: '#E0F2FE', color: '#0C4A6E' },
  stolon:        { bg: '#F0FDF4', color: '#14532D' },
  rhizome:       { bg: '#FEF9C3', color: '#713F12' },
  semis_direct:  { bg: '#F1F5F9', color: '#475569' },
}

type Props = {
  initialPlantings: PlantingWithRelations[]
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  seedlings: SeedlingForSelect[]
}

const PLANTATIONS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string })?.nom_vernaculaire ?? '' },
  { key: '_rang', label: 'Rang' },
  { key: 'date_plantation', label: 'Date plantation' },
  { key: 'annee', label: 'Année' },
  { key: 'nb_plants', label: 'Nb plants' },
  { key: 'type_plant', label: 'Type plant', format: (v) => TYPE_PLANT_LABELS[v as string] ?? String(v ?? '') },
  { key: 'longueur_m', label: 'Longueur (m)' },
  { key: 'largeur_m', label: 'Largeur (m)' },
  { key: 'actif', label: 'Actif', format: (v) => v ? 'Oui' : 'Non' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function PlantationsClient({ initialPlantings, rows, varieties, seedlings }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [plantings, setPlantings] = useState(initialPlantings)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingPlanting, setEditingPlanting] = useState<PlantingWithRelations | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    setPlantings(initialPlantings)
  }, [initialPlantings])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active = plantings.filter(p => !p.deleted_at)
  const archived = plantings.filter(p => !!p.deleted_at)

  const displayed = (showArchived ? archived : active).filter(p => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (p.varieties?.nom_vernaculaire && normalize(p.varieties.nom_vernaculaire).includes(q)) ||
      normalize(rowLabel(p)).includes(q) ||
      (p.fournisseur && normalize(p.fournisseur).includes(q))
    )
  })

  function openCreate() {
    setEditingPlanting(null)
    setSlideOverOpen(true)
  }

  function openEdit(p: PlantingWithRelations) {
    setEditingPlanting(p)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingPlanting) return updatePlanting(editingPlanting.id, formData)
    return createPlanting(formData)
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
        await archivePlanting(id)
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
      await restorePlanting(id)
      setPendingId(null)
      router.refresh()
    })
  }

  /** Calcule la surface en m² si les dimensions sont présentes */
  function surface(p: PlantingWithRelations): string {
    if (p.longueur_m != null && p.largeur_m != null) {
      return `${(p.longueur_m * p.largeur_m).toFixed(1)} m²`
    }
    return '—'
  }

  /** Origine de la plantation (semis ou fournisseur) */
  function origin(p: PlantingWithRelations): React.ReactNode {
    if (p.seedling_id && p.seedlings) {
      return (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
        >
          Semis {p.seedlings.processus === 'mini_motte' ? 'MM' : 'CG'}
        </span>
      )
    }
    if (p.fournisseur) {
      return (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#F3E8FF', color: '#6B21A8' }}
        >
          {p.fournisseur}
        </span>
      )
    }
    return <Dash />
  }

  return (
    <div className="p-8">
      {/* ---- En-tête ---- */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Plantations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} plantation{active.length !== 1 ? 's' : ''} active{active.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed.map(p => ({ ...p, _rang: rowLabel(p) })) as unknown as Record<string, unknown>[]}
            columns={PLANTATIONS_EXPORT_COLUMNS}
            filename="plantations"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">＋</span>
            Nouvelle plantation
          </button>
        </div>
      </div>

      {/* ---- Barre de recherche + toggle archivés ---- */}
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
            placeholder="Rechercher par variété, rang, fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="px-3 py-2 text-xs rounded-lg border transition-colors"
            style={{
              borderColor: showArchived ? 'var(--color-primary)' : '#D8E0D9',
              color: showArchived ? 'var(--color-primary)' : '#9CA89D',
              backgroundColor: showArchived ? 'rgba(58,90,64,0.06)' : 'transparent',
            }}
          >
            {showArchived ? `Archivées (${archived.length})` : `${archived.length} archivée${archived.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* ---- Tableau ---- */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-sm">
            {search
              ? 'Aucune plantation ne correspond à la recherche.'
              : showArchived
                ? 'Aucune plantation archivée.'
                : 'Aucune plantation. Commencez par en créer une.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Variété</Th>
                <Th>Rang</Th>
                <Th>Date</Th>
                <Th>Plants</Th>
                <Th>Type</Th>
                <Th>Origine</Th>
                <Th>Surface</Th>
                <Th>État</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const isPending = pendingId === p.id
                const isConfirming = confirmArchiveId === p.id
                const typePlant = p.type_plant ?? ''
                const typeColors = TYPE_PLANT_COLORS[typePlant] ?? { bg: '#F3F4F6', color: '#6B7280' }

                return (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isPending ? 0.4 : 1,
                    }}
                  >
                    {/* Variété */}
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {p.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>

                    {/* Rang */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {rowLabel(p)}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(p.date_plantation)}
                    </td>

                    {/* Nb plants */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {p.nb_plants ?? <Dash />}
                    </td>

                    {/* Type plant */}
                    <td className="px-4 py-3">
                      {typePlant ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: typeColors.bg, color: typeColors.color }}
                        >
                          {TYPE_PLANT_LABELS[typePlant] ?? typePlant}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>

                    {/* Origine */}
                    <td className="px-4 py-3">{origin(p)}</td>

                    {/* Surface */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {surface(p)}
                    </td>

                    {/* État */}
                    <td className="px-4 py-3">
                      {p.actif ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                        >
                          Actif
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                        >
                          Arraché
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {showArchived ? (
                          <button
                            onClick={() => handleRestore(p.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(p.id)}
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
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleArchiveClick(p.id)}
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

      {/* ---- Slide-over ---- */}
      <PlantationSlideOver
        key={editingPlanting?.id ?? 'new'}
        open={slideOverOpen}
        planting={editingPlanting}
        rows={rows}
        varieties={varieties}
        seedlings={seedlings}
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
