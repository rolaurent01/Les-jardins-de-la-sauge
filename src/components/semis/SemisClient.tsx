'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SeedlingWithRelations, Variety, Processus } from '@/lib/types'
import {
  archiveSeedling,
  restoreSeedling,
  createSeedling,
  updateSeedling,
} from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import { computeSeedlingLossRate } from '@/lib/utils/seedling-stats'
import SemisSlideOver from './SemisSlideOver'

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

type ProcessFilter = 'all' | 'mini_motte' | 'caissette_godet'

export type SeedLotForSelect = {
  id: string
  lot_interne: string
  varieties: { nom_vernaculaire: string } | null
}

type Props = {
  initialSeedlings: SeedlingWithRelations[]
  seedLots: SeedLotForSelect[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
}

export default function SemisClient({ initialSeedlings, seedLots, varieties }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [seedlings, setSeedlings]               = useState(initialSeedlings)
  const [search, setSearch]                     = useState('')
  const [showArchived, setShowArchived]         = useState(false)
  const [processFilter, setProcessFilter]       = useState<ProcessFilter>('all')
  const [slideOverOpen, setSlideOverOpen]       = useState(false)
  const [editingSeedling, setEditingSeedling]   = useState<SeedlingWithRelations | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId]               = useState<string | null>(null)

  /* Sync quand Next.js re-fetche après router.refresh() */
  useEffect(() => {
    setSeedlings(initialSeedlings)
  }, [initialSeedlings])

  /* Reset la confirmation d'archivage après 4s */
  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active   = seedlings.filter(s => !s.deleted_at)
  const archived = seedlings.filter(s => !!s.deleted_at)

  const displayed = (showArchived ? archived : active).filter(s => {
    const matchProcess = processFilter === 'all' || s.processus === processFilter
    if (!matchProcess) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (s.varieties?.nom_vernaculaire && normalize(s.varieties.nom_vernaculaire).includes(q)) ||
      (s.seed_lots?.lot_interne && normalize(s.seed_lots.lot_interne).includes(q)) ||
      (s.numero_caisse && normalize(s.numero_caisse).includes(q))
    )
  })

  function openCreate() {
    setEditingSeedling(null)
    setSlideOverOpen(true)
  }

  function openEdit(s: SeedlingWithRelations) {
    setEditingSeedling(s)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingSeedling) return updateSeedling(editingSeedling.id, formData)
    return createSeedling(formData)
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
        await archiveSeedling(id)
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
      await restoreSeedling(id)
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
            Suivi des semis
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} semis actif{active.length !== 1 ? 's' : ''}
            {archived.length > 0 && (
              <> · {archived.length} archivé{archived.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">＋</span>
          Nouveau semis
        </button>
      </div>

      {/* ---- Barre d'outils ---- */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Recherche */}
        <div className="relative flex-1 max-w-sm">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#9CA89D' }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par variété, sachet, caisse…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtres processus */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: '#D8E0D9' }}
        >
          {(
            [
              { value: 'all',             label: 'Tous'            },
              { value: 'mini_motte',      label: 'Mini-mottes'     },
              { value: 'caissette_godet', label: 'Caissette/Godet' },
            ] as const
          ).map(opt => (
            <button
              key={opt.value}
              onClick={() => setProcessFilter(opt.value)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: processFilter === opt.value ? 'var(--color-primary)' : 'transparent',
                color:           processFilter === opt.value ? '#F9F8F6' : '#9CA89D',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Toggle archivés */}
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
              ? 'Aucun semis ne correspond à la recherche.'
              : showArchived
              ? 'Aucun semis archivé.'
              : 'Aucun semis. Commencez par en créer un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Variété</Th>
                <Th>Processus</Th>
                <Th>Sachet source</Th>
                <Th>Date semis</Th>
                <Th align="right">Départ</Th>
                <Th align="right">Obtenus</Th>
                <Th align="right">Perte</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, i) => {
                const isArchived   = !!s.deleted_at
                const isPending    = pendingId === s.id
                const isConfirming = confirmArchiveId === s.id

                /* Calcul du taux de perte */
                const stats   = computeSeedlingLossRate(s)
                const pertePct =
                  s.processus === 'mini_motte'
                    ? ('perte_pct' in stats ? stats.perte_pct : null)
                    : ('perte_globale_pct' in stats ? stats.perte_globale_pct : null)

                const perteColor =
                  pertePct == null ? '#D8E0D9'
                  : pertePct < 20  ? '#166534'
                  : pertePct < 40  ? '#92400E'
                  : '#991B1B'

                const perteBg =
                  pertePct == null ? 'transparent'
                  : pertePct < 20  ? '#DCFCE7'
                  : pertePct < 40  ? '#FEF3C7'
                  : '#FEE2E2'

                /* Départ selon processus */
                const depart =
                  s.processus === 'mini_motte' ? s.nb_mottes : s.nb_plants_caissette

                return (
                  <tr
                    key={s.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom:    '1px solid #EDE8E0',
                      opacity:         isArchived || isPending ? 0.5 : 1,
                    }}
                  >
                    {/* Variété */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {s.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>

                    {/* Processus */}
                    <td className="px-4 py-3">
                      <ProcessBadge processus={s.processus} />
                    </td>

                    {/* Sachet source */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {s.seed_lots?.lot_interne ?? <Dash />}
                    </td>

                    {/* Date semis */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {formatDate(s.date_semis)}
                    </td>

                    {/* Départ */}
                    <td className="px-4 py-3 text-right font-medium" style={{ color: '#2C3E2D' }}>
                      {depart ?? <Dash />}
                    </td>

                    {/* Obtenus */}
                    <td className="px-4 py-3 text-right" style={{ color: '#6B7B6C' }}>
                      {s.nb_plants_obtenus ?? <Dash />}
                    </td>

                    {/* Perte */}
                    <td className="px-4 py-3 text-right">
                      {pertePct == null ? (
                        <Dash />
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: perteBg, color: perteColor }}
                        >
                          {Math.round(pertePct)}%
                        </span>
                      )}
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
      <SemisSlideOver
        key={editingSeedling?.id ?? 'new'}
        open={slideOverOpen}
        seedling={editingSeedling}
        seedLots={seedLots}
        varieties={varieties}
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

function ProcessBadge({ processus }: { processus: Processus }) {
  const isMiniMotte = processus === 'mini_motte'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: isMiniMotte ? '#DCFCE7' : '#DBEAFE',
        color:           isMiniMotte ? '#166534' : '#1E40AF',
      }}
    >
      {isMiniMotte ? 'Mini-motte' : 'Caissette/Godet'}
    </span>
  )
}
