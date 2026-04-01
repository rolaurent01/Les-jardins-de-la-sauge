'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Variety, CuttingStatut } from '@/lib/types'
import { CUTTING_STATUT_LABELS, TYPE_MULTIPLICATION_LABELS } from '@/lib/types'
import type { CuttingWithPlantsInfo } from '@/app/[orgSlug]/(dashboard)/semis/boutures/actions'
import {
  archiveCutting,
  restoreCutting,
  createCutting,
  updateCutting,
} from '@/app/[orgSlug]/(dashboard)/semis/boutures/actions'
import BoutureSlideOver from './BoutureSlideOver'
import YearFilter from '@/components/shared/YearFilter'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { normalize } from '@/lib/utils/normalize'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type StatutFilter = 'all' | CuttingStatut

type Props = {
  initialCuttings: CuttingWithPlantsInfo[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
}

const BOUTURES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'type_multiplication', label: 'Type', format: (v) => TYPE_MULTIPLICATION_LABELS[v as keyof typeof TYPE_MULTIPLICATION_LABELS] ?? String(v) },
  { key: 'date_bouturage', label: 'Date bouturage' },
  { key: 'origine', label: 'Origine' },
  { key: 'nb_plaques', label: 'Nb plaques' },
  { key: 'nb_trous_par_plaque', label: 'Trous/plaque' },
  { key: 'nb_godets', label: 'Nb godets' },
  { key: 'nb_plants_obtenus', label: 'Plants obtenus' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function BouturesClient({ initialCuttings, varieties }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [cuttings, setCuttings]               = useState(initialCuttings)
  const [search, setSearch]                   = useState('')
  const [showArchived, setShowArchived]       = useState(false)
  const [statutFilter, setStatutFilter]       = useState<StatutFilter>('all')
  const [selectedYear, setSelectedYear]       = useState<number | null>(new Date().getFullYear())
  const [slideOverOpen, setSlideOverOpen]     = useState(false)
  const [editingCutting, setEditingCutting]   = useState<CuttingWithPlantsInfo | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId]             = useState<string | null>(null)

  useEffect(() => { setCuttings(initialCuttings) }, [initialCuttings])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active   = cuttings.filter(c => !c.deleted_at)
  const archived = cuttings.filter(c => !!c.deleted_at)

  // Années disponibles
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const c of cuttings) {
      if (c.date_bouturage) set.add(new Date(c.date_bouturage).getFullYear())
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [cuttings])

  const displayed = (showArchived ? archived : active).filter(c => {
    if (selectedYear !== null && c.date_bouturage) {
      if (new Date(c.date_bouturage).getFullYear() !== selectedYear) return false
    }
    if (statutFilter !== 'all' && c.statut !== statutFilter) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (c.varieties?.nom_vernaculaire && normalize(c.varieties.nom_vernaculaire).includes(q)) ||
      (c.origine && normalize(c.origine).includes(q)) ||
      (c.type_multiplication && normalize(TYPE_MULTIPLICATION_LABELS[c.type_multiplication]).includes(q))
    )
  })

  function openCreate() {
    setEditingCutting(null)
    setSlideOverOpen(true)
  }

  function openEdit(c: CuttingWithPlantsInfo) {
    setEditingCutting(c)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingCutting) return updateCutting(editingCutting.id, formData)
    return createCutting(formData)
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
        await archiveCutting(id)
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
      await restoreCutting(id)
      setPendingId(null)
      router.refresh()
    })
  }

  // Boutures actives filtrées par année (pour compteurs statut cohérents)
  const activeForYear = selectedYear !== null
    ? active.filter(c => c.date_bouturage && new Date(c.date_bouturage).getFullYear() === selectedYear)
    : active

  // Compteurs par statut pour les filtres
  const statutCounts: Partial<Record<CuttingStatut, number>> = {}
  for (const c of activeForYear) {
    statutCounts[c.statut] = (statutCounts[c.statut] ?? 0) + 1
  }

  return (
    <div className="p-4 md:p-8">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Boutures
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {activeForYear.length} bouture{activeForYear.length !== 1 ? 's' : ''} active{activeForYear.length !== 1 ? 's' : ''}
            {selectedYear !== null && <> ({selectedYear})</>}
            {archived.length > 0 && (
              <> · {archived.length} archivée{archived.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={BOUTURES_EXPORT_COLUMNS}
            filename="boutures"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">＋</span>
            Nouvelle bouture
          </button>
        </div>
      </div>

      {/* Filtre année */}
      <div className="mb-4">
        <YearFilter years={years} selectedYear={selectedYear} onChange={setSelectedYear} />
      </div>

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher par variété, origine, type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e  => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtre statut */}
        <select
          value={statutFilter}
          onChange={e => setStatutFilter(e.target.value as StatutFilter)}
          className="px-3 py-1.5 text-xs rounded-lg border outline-none"
          style={{ borderColor: '#D8E0D9', backgroundColor: '#FAF5E9', color: '#2C3E2D' }}
        >
          <option value="all">Tous statuts</option>
          {(['bouture', 'repiquage', 'pret', 'en_plantation', 'epuise'] as CuttingStatut[]).map(s => (
            <option key={s} value={s}>
              {CUTTING_STATUT_LABELS[s]} {statutCounts[s] ? `(${statutCounts[s]})` : ''}
            </option>
          ))}
        </select>

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
            {showArchived ? '← Actives' : `Archivées (${archived.length})`}
          </button>
        )}
      </div>

      {/* Fiches */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}>
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm">
            {search ? 'Aucune bouture ne correspond à la recherche.'
              : showArchived ? 'Aucune bouture archivée.'
              : 'Aucune bouture. Commencez par en créer une.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(c => (
            <CuttingCard
              key={c.id}
              cutting={c}
              isArchived={!!c.deleted_at}
              isPending={pendingId === c.id}
              isConfirming={confirmArchiveId === c.id}
              onEdit={() => openEdit(c)}
              onArchive={() => handleArchiveClick(c.id)}
              onRestore={() => handleRestore(c.id)}
              onCancelConfirm={() => setConfirmArchiveId(null)}
            />
          ))}
        </div>
      )}

      {/* Slide-over */}
      <BoutureSlideOver
        key={editingCutting?.id ?? 'new'}
        open={slideOverOpen}
        cutting={editingCutting}
        varieties={varieties}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Fiche bouture avec timeline ---- */

function CuttingCard({
  cutting: c,
  isArchived,
  isPending,
  isConfirming,
  onEdit,
  onArchive,
  onRestore,
  onCancelConfirm,
}: {
  cutting: CuttingWithPlantsInfo
  isArchived: boolean
  isPending: boolean
  isConfirming: boolean
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onCancelConfirm: () => void
}) {
  const usePlaque = c.nb_plaques != null
  const steps = usePlaque
    ? ['bouture', 'repiquage', 'pret', 'en_plantation'] as const
    : ['bouture', 'pret', 'en_plantation'] as const

  const stepLabels: Record<string, string> = {
    bouture: 'Bouturé',
    repiquage: 'Rempotage',
    pret: 'Prêt',
    en_plantation: 'Planté',
  }

  const currentStatut = c.statut === 'epuise' ? 'en_plantation' : c.statut
  const currentIdx = (steps as readonly string[]).indexOf(currentStatut)

  const badge = STATUT_BADGE[c.statut]

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: '#D8E0D9',
        backgroundColor: '#FAF5E9',
        opacity: isArchived || isPending ? 0.5 : 1,
      }}
    >
      {/* Ligne du haut : identifiant + badge statut */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <span className="font-semibold text-sm" style={{ color: '#2C3E2D' }}>
            {c.varieties?.nom_vernaculaire ?? '?'}
          </span>
          <span className="ml-2 text-xs" style={{ color: '#9CA89D' }}>
            {TYPE_MULTIPLICATION_LABELS[c.type_multiplication]}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {badge.icon} {badge.label}
          {c.statut === 'en_plantation' && c.plants_restants != null && (
            <span> ({c.plants_restants} restants)</span>
          )}
        </span>
      </div>

      {/* Sous-titre */}
      <div className="text-xs mb-3" style={{ color: '#9CA89D' }}>
        {usePlaque
          ? `${c.nb_plaques} plaque${(c.nb_plaques ?? 0) > 1 ? 's' : ''} × ${c.nb_trous_par_plaque} trous → Godet`
          : 'Direct en godet'
        }
        {c.origine && <> · {c.origine}</>}
        {c.certif_ab && <> · AB ✓</>}
      </div>

      {/* Timeline / Stepper */}
      <div className="flex items-center mb-3">
        {steps.map((step, i) => {
          const isFilled = currentIdx >= 0 && i < currentIdx
          const isCurrent = i === currentIdx
          const isEpuise = c.statut === 'epuise' && step === 'en_plantation'

          return (
            <div key={step} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div className="flex flex-col items-center">
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 20, height: 20,
                    backgroundColor: isFilled || isEpuise
                      ? 'var(--color-primary)'
                      : isCurrent
                        ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                        : '#D8E0D9',
                  }}
                >
                  {(isFilled || isEpuise) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4 7L8 3" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isCurrent && !isEpuise && (
                    <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: 'var(--color-primary)' }} />
                  )}
                </div>
                <span
                  className="text-[10px] mt-0.5 whitespace-nowrap"
                  style={{ color: isFilled || isCurrent || isEpuise ? '#2C3E2D' : '#9CA89D' }}
                >
                  {stepLabels[step]}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className="flex-1 mx-1"
                  style={{
                    height: 2,
                    marginBottom: 14,
                    backgroundColor: isFilled ? 'var(--color-primary)' : '#D8E0D9',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Dates */}
      <div className="flex items-center gap-3 text-xs flex-wrap mb-2" style={{ color: '#6B7B6C' }}>
        <span>Bouturé le {formatDate(c.date_bouturage)}</span>
        {c.date_mise_en_plaque && <span>· En plaque le {formatDate(c.date_mise_en_plaque)}</span>}
        {c.date_rempotage && <span>· Rempoté le {formatDate(c.date_rempotage)}</span>}
      </div>

      {/* Info plants */}
      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: '#6B7B6C' }}>
        {usePlaque && (
          <span>{(c.nb_plaques ?? 0) * (c.nb_trous_par_plaque ?? 0)} boutures en plaque</span>
        )}
        {c.nb_godets != null && c.nb_godets > 0 && (
          <span>{usePlaque ? '· ' : ''}{c.nb_godets} godets</span>
        )}
        {c.nb_plants_obtenus != null && (
          <span>· {c.nb_plants_obtenus} plants obtenus</span>
        )}
        {c.plants_plantes > 0 && (
          <span style={{ color: 'var(--color-primary)' }}>
            · {c.plants_plantes} planté{c.plants_plantes > 1 ? 's' : ''}
          </span>
        )}
        {c.plants_restants != null && c.plants_restants > 0 && c.plants_plantes > 0 && (
          <span style={{ color: '#92400E' }}>
            · {c.plants_restants} restant{c.plants_restants > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 mt-3 pt-2" style={{ borderTop: '1px solid #EDE8E0' }}>
        {isArchived ? (
          <button
            onClick={onRestore}
            disabled={isPending}
            className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            Restaurer
          </button>
        ) : isConfirming ? (
          <>
            <button
              onClick={onArchive}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: '#BC6C25', color: '#FFF' }}
            >
              Confirmer
            </button>
            <button
              onClick={onCancelConfirm}
              className="px-2.5 py-1 rounded-lg text-xs border"
              style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="px-2.5 py-1 rounded-lg text-xs transition-colors"
              style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
            >
              Modifier
            </button>
            <button
              onClick={onArchive}
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
    </div>
  )
}

/* ---- Badges statut ---- */

const STATUT_BADGE: Record<CuttingStatut, { icon: string; label: string; bg: string; color: string }> = {
  bouture:        { icon: '🌿', label: 'Bouturé',         bg: '#F5F2ED', color: '#6B7B6C' },
  repiquage:      { icon: '🔄', label: 'En rempotage',    bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { icon: '✅', label: 'Prêt à planter',  bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { icon: '🌱', label: 'En plantation',   bg: '#FEF3C7', color: '#92400E' },
  epuise:         { icon: '✔️', label: 'Épuisé',           bg: '#F5F2ED', color: '#9CA89D' },
}
