'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SeedLotWithVariety, Variety } from '@/lib/types'
import { archiveSeedLot, restoreSeedLot, createSeedLot, updateSeedLot } from '@/app/[orgSlug]/(dashboard)/semis/sachets/actions'
import SachetSlideOver from './SachetSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'

/* Normalise une chaîne pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Formate une date ISO (YYYY-MM-DD) en JJ/MM/AAAA */
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  initialSeedLots: SeedLotWithVariety[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
  certifBio?: boolean
}

const SACHETS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'lot_interne', label: 'N° Lot' },
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'date_achat', label: 'Date achat' },
  { key: 'poids_sachet_g', label: 'Poids sachet (g)' },
  { key: 'certif_ab', label: 'Certif AB', format: (v) => v ? 'Oui' : 'Non' },
  { key: 'numero_lot_fournisseur', label: 'N° lot fournisseur' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function SachetsClient({ initialSeedLots, varieties, certifBio = false }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [seedLots, setSeedLots] = useState(initialSeedLots)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<SeedLotWithVariety | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  /* Sync quand Next.js re-fetche après router.refresh() */
  useEffect(() => {
    setSeedLots(initialSeedLots)
  }, [initialSeedLots])

  /* Reset la confirmation d'archivage si on clique ailleurs */
  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active   = seedLots.filter(s => !s.deleted_at)
  const archived = seedLots.filter(s => !!s.deleted_at)

  const displayed = (showArchived ? archived : active).filter(s => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(s.lot_interne).includes(q) ||
      (s.varieties?.nom_vernaculaire && normalize(s.varieties.nom_vernaculaire).includes(q)) ||
      (s.fournisseur && normalize(s.fournisseur).includes(q))
    )
  })

  function openCreate() {
    setEditingLot(null)
    setSlideOverOpen(true)
  }

  function openEdit(lot: SeedLotWithVariety) {
    setEditingLot(lot)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingLot) {
      return updateSeedLot(editingLot.id, formData)
    }
    return createSeedLot(formData)
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
        await archiveSeedLot(id)
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
      await restoreSeedLot(id)
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="p-8">
      {/* ---- En-tête ---- */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Sachets de graines
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} sachet{active.length !== 1 ? 's' : ''} actif{active.length !== 1 ? 's' : ''}
            {archived.length > 0 && (
              <> · {archived.length} archivé{archived.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={SACHETS_EXPORT_COLUMNS}
            filename="sachets_graines"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">＋</span>
            Nouveau sachet
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
            placeholder="Rechercher par lot, variété, fournisseur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{
              backgroundColor: '#FAF5E9',
              borderColor: '#D8E0D9',
              color: '#2C3E2D',
            }}
            onFocus={e  => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e   => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors"
            style={{
              borderColor:     showArchived ? 'var(--color-primary)' : '#D8E0D9',
              backgroundColor: showArchived ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)' : 'transparent',
              color:           showArchived ? 'var(--color-primary)' : '#9CA89D',
            }}
          >
            {showArchived ? '← Actifs' : `Archivés (${archived.length})`}
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
              ? 'Aucun sachet ne correspond à la recherche.'
              : showArchived
              ? 'Aucun sachet archivé.'
              : 'Aucun sachet. Commencez par en créer un.'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#D8E0D9' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Lot</Th>
                <Th>Variété</Th>
                <Th>Fournisseur</Th>
                <Th>Date achat</Th>
                <Th align="right">Poids sachet</Th>
                <Th>AB</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, i) => {
                const isArchived   = !!s.deleted_at
                const isPending    = pendingId === s.id
                const isConfirming = confirmArchiveId === s.id

                return (
                  <tr
                    key={s.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom:    '1px solid #EDE8E0',
                      opacity:         isArchived || isPending ? 0.5 : 1,
                    }}
                  >
                    {/* Lot interne */}
                    <td className="px-4 py-3 font-semibold" style={{ color: '#2C3E2D' }}>
                      {s.lot_interne}
                    </td>

                    {/* Variété */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {s.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>

                    {/* Fournisseur */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {s.fournisseur ?? <Dash />}
                    </td>

                    {/* Date achat */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {formatDate(s.date_achat)}
                    </td>

                    {/* Poids sachet */}
                    <td className="px-4 py-3 text-right" style={{ color: '#6B7B6C' }}>
                      {s.poids_sachet_g != null ? `${s.poids_sachet_g} g` : <Dash />}
                    </td>

                    {/* Certification AB */}
                    <td className="px-4 py-3">
                      {s.certif_ab ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                        >
                          AB
                        </span>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isArchived ? (
                          <button
                            onClick={() => handleRestore(s.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(s.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
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
                              onClick={() => openEdit(s)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleArchiveClick(s.id)}
                              className="p-1.5 rounded-lg transition-colors"
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

      {/* ---- Slide-over ---- */}
      <SachetSlideOver
        key={editingLot?.id ?? 'new'}
        open={slideOverOpen}
        seedLot={editingLot}
        varieties={varieties}
        certifBio={certifBio}
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
