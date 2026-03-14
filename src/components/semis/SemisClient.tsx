'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Variety, SeedlingStatut } from '@/lib/types'
import { SEEDLING_STATUT_LABELS } from '@/lib/types'
import type { SeedlingWithPlantsInfo } from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import {
  archiveSeedling,
  restoreSeedling,
  createSeedling,
  updateSeedling,
} from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import SemisSlideOver from './SemisSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type ProcessFilter = 'all' | 'mini_motte' | 'caissette_godet'
type StatutFilter = 'all' | SeedlingStatut

export type SeedLotForSelect = {
  id: string
  lot_interne: string
  variety_id: string
  fournisseur: string | null
  numero_lot_fournisseur: string | null
  varieties: { nom_vernaculaire: string } | null
}

type Props = {
  initialSeedlings: SeedlingWithPlantsInfo[]
  seedLots: SeedLotForSelect[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
}

const SEMIS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'processus', label: 'Processus', format: (v) => v === 'mini_motte' ? 'Mini-motte' : 'Caissette/Godet' },
  { key: 'date_semis', label: 'Date semis' },
  { key: 'nb_mottes', label: 'Nb mottes' },
  { key: 'nb_plants_caissette', label: 'Nb plants caissette' },
  { key: 'nb_plants_obtenus', label: 'Nb plants obtenus' },
  { key: 'poids_graines_utilise_g', label: 'Poids graines (g)' },
  { key: 'commentaire', label: 'Commentaire' },
]

export default function SemisClient({ initialSeedlings, seedLots, varieties }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [seedlings, setSeedlings]               = useState(initialSeedlings)
  const [search, setSearch]                     = useState('')
  const [showArchived, setShowArchived]         = useState(false)
  const [processFilter, setProcessFilter]       = useState<ProcessFilter>('all')
  const [statutFilter, setStatutFilter]         = useState<StatutFilter>('all')
  const [slideOverOpen, setSlideOverOpen]       = useState(false)
  const [editingSeedling, setEditingSeedling]   = useState<SeedlingWithPlantsInfo | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId]               = useState<string | null>(null)

  useEffect(() => { setSeedlings(initialSeedlings) }, [initialSeedlings])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active   = seedlings.filter(s => !s.deleted_at)
  const archived = seedlings.filter(s => !!s.deleted_at)

  const displayed = (showArchived ? archived : active).filter(s => {
    if (processFilter !== 'all' && s.processus !== processFilter) return false
    if (statutFilter !== 'all' && s.statut !== statutFilter) return false
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

  function openEdit(s: SeedlingWithPlantsInfo) {
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

  // Compteurs par statut pour les filtres
  const statutCounts: Partial<Record<SeedlingStatut, number>> = {}
  for (const s of active) {
    statutCounts[s.statut] = (statutCounts[s.statut] ?? 0) + 1
  }

  return (
    <div className="p-4 md:p-8">
      {/* En-tête */}
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

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={SEMIS_EXPORT_COLUMNS}
            filename="suivi_semis"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">＋</span>
            Nouveau semis
          </button>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>🔍</span>
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
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#D8E0D9' }}>
          {([
            { value: 'all', label: 'Tous' },
            { value: 'mini_motte', label: 'Mini-mottes' },
            { value: 'caissette_godet', label: 'Caissette/Godet' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setProcessFilter(opt.value)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: processFilter === opt.value ? 'var(--color-primary)' : 'transparent',
                color: processFilter === opt.value ? '#F9F8F6' : '#9CA89D',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filtre statut */}
        <select
          value={statutFilter}
          onChange={e => setStatutFilter(e.target.value as StatutFilter)}
          className="px-3 py-1.5 text-xs rounded-lg border outline-none"
          style={{ borderColor: '#D8E0D9', backgroundColor: '#FAF5E9', color: '#2C3E2D' }}
        >
          <option value="all">Tous statuts</option>
          {(['semis', 'leve', 'repiquage', 'pret', 'en_plantation', 'epuise'] as SeedlingStatut[]).map(s => (
            <option key={s} value={s}>
              {SEEDLING_STATUT_LABELS[s]} {statutCounts[s] ? `(${statutCounts[s]})` : ''}
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
            {showArchived ? '← Actifs' : `Archivés (${archived.length})`}
          </button>
        )}
      </div>

      {/* Fiches */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}>
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-sm">
            {search ? 'Aucun semis ne correspond à la recherche.'
              : showArchived ? 'Aucun semis archivé.'
              : 'Aucun semis. Commencez par en créer un.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(s => (
            <SeedlingCard
              key={s.id}
              seedling={s}
              isArchived={!!s.deleted_at}
              isPending={pendingId === s.id}
              isConfirming={confirmArchiveId === s.id}
              onEdit={() => openEdit(s)}
              onArchive={() => handleArchiveClick(s.id)}
              onRestore={() => handleRestore(s.id)}
              onCancelConfirm={() => setConfirmArchiveId(null)}
            />
          ))}
        </div>
      )}

      {/* Slide-over */}
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

/* ---- Fiche semis avec timeline ---- */

function SeedlingCard({
  seedling: s,
  isArchived,
  isPending,
  isConfirming,
  onEdit,
  onArchive,
  onRestore,
  onCancelConfirm,
}: {
  seedling: SeedlingWithPlantsInfo
  isArchived: boolean
  isPending: boolean
  isConfirming: boolean
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onCancelConfirm: () => void
}) {
  const isMiniMotte = s.processus === 'mini_motte'
  const steps = isMiniMotte
    ? ['semis', 'leve', 'pret', 'en_plantation'] as const
    : ['semis', 'leve', 'repiquage', 'pret', 'en_plantation'] as const

  const stepLabels: Record<string, string> = {
    semis: 'Semé',
    leve: 'Levé',
    repiquage: 'Repiq.',
    pret: 'Prêt',
    en_plantation: 'Planté',
  }

  // Déterminer l'index du statut courant dans les étapes
  const currentStatut = s.statut === 'epuise' ? 'en_plantation' : s.statut
  const currentIdx = (steps as readonly string[]).indexOf(currentStatut)

  const badge = STATUT_BADGE[s.statut]

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
            {s.varieties?.nom_vernaculaire ?? '?'}
          </span>
          {s.numero_caisse && (
            <span className="ml-2 text-xs" style={{ color: '#9CA89D' }}>
              Caisse {s.numero_caisse}
            </span>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {badge.icon} {badge.label}
          {s.statut === 'en_plantation' && s.plants_restants != null && (
            <span> ({s.plants_restants} restants)</span>
          )}
        </span>
      </div>

      {/* Sous-titre */}
      <div className="text-xs mb-3" style={{ color: '#9CA89D' }}>
        {isMiniMotte ? 'Mini-motte' : 'Caissette/Godet'}
        {s.seed_lots && (
          <> · Sachet {s.seed_lots.lot_interne}</>
        )}
        {s.seed_lots?.fournisseur && (
          <> — {s.seed_lots.fournisseur}</>
        )}
      </div>

      {/* Timeline / Stepper */}
      <div className="flex items-center mb-3">
        {steps.map((step, i) => {
          const isFilled = currentIdx >= 0 && i < currentIdx
          const isCurrent = i === currentIdx
          const isEpuise = s.statut === 'epuise' && step === 'en_plantation'

          return (
            <div key={step} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
              {/* Point */}
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

              {/* Ligne entre les points */}
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

      {/* Dates et infos sous la timeline */}
      <div className="flex items-center gap-3 text-xs flex-wrap mb-2" style={{ color: '#6B7B6C' }}>
        <span>Semé le {formatDate(s.date_semis)}</span>
        {s.date_levee && <span>· Levé le {formatDate(s.date_levee)}</span>}
        {s.date_repiquage && !isMiniMotte && <span>· Repiqué le {formatDate(s.date_repiquage)}</span>}
      </div>

      {/* Info plants */}
      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: '#6B7B6C' }}>
        {isMiniMotte && s.nb_mottes != null && (
          <span>{s.nb_mottes} mottes</span>
        )}
        {!isMiniMotte && s.nb_plants_caissette != null && (
          <span>{s.nb_plants_caissette} plants en caissette</span>
        )}
        {s.nb_plants_obtenus != null && (
          <span>· {s.nb_plants_obtenus} plants obtenus</span>
        )}
        {s.plants_plantes > 0 && (
          <span style={{ color: 'var(--color-primary)' }}>
            · {s.plants_plantes} planté{s.plants_plantes > 1 ? 's' : ''}
          </span>
        )}
        {s.plants_restants != null && s.plants_restants > 0 && s.plants_plantes > 0 && (
          <span style={{ color: '#92400E' }}>
            · {s.plants_restants} restant{s.plants_restants > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Message contextuel */}
      {s.statut !== 'epuise' && s.statut !== 'en_plantation' && s.nb_plants_obtenus == null && s.date_levee != null && (
        <div className="mt-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          En attente de nb_plants_obtenus
        </div>
      )}

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

const STATUT_BADGE: Record<SeedlingStatut, { icon: string; label: string; bg: string; color: string }> = {
  semis:          { icon: '🌰', label: 'Semé',           bg: '#F5F2ED', color: '#6B7B6C' },
  leve:           { icon: '🌱', label: 'Levé',           bg: '#DCFCE7', color: '#166534' },
  repiquage:      { icon: '🔄', label: 'En repiquage',   bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { icon: '✅', label: 'Prêt à planter', bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { icon: '🌿', label: 'En plantation',  bg: '#FEF3C7', color: '#92400E' },
  epuise:         { icon: '✔️', label: 'Épuisé',          bg: '#F5F2ED', color: '#9CA89D' },
}
