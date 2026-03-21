'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCachedSeedlings } from '@/hooks/useCachedData'
import type { CachedSeedling } from '@/lib/offline/db'
import { SEEDLING_STATUT_LABELS } from '@/lib/types'
import type { SeedlingStatut } from '@/lib/types'
import AvancerSemisForm from '@/components/mobile/forms/AvancerSemisForm'

/** Couleurs des badges statut */
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  semis:          { bg: '#F5F2ED', color: '#6B7B6C' },
  leve:           { bg: '#DCFCE7', color: '#166534' },
  repiquage:      { bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { bg: '#FEF3C7', color: '#92400E' },
  epuise:         { bg: '#F5F2ED', color: '#9CA89D' },
}

/** Statuts qui peuvent être avancés */
const ADVANCEABLE_STATUTS = new Set<string>(['semis', 'leve', 'repiquage'])

/** Ordre d'affichage des statuts */
const STATUT_ORDER: SeedlingStatut[] = ['semis', 'leve', 'repiquage', 'pret', 'en_plantation', 'epuise']

/** Page mobile — Liste des semis avec avancement */
export default function AvancementSemisPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const { seedlings, isLoading } = useCachedSeedlings()
  const [selected, setSelected] = useState<CachedSeedling | null>(null)

  // Si un semis est sélectionné, afficher le formulaire d'avancement
  if (selected) {
    return (
      <AvancerSemisForm
        seedling={selected}
        orgSlug={orgSlug}
        onBack={() => setSelected(null)}
      />
    )
  }

  // Grouper par statut
  const byStatut = new Map<string, CachedSeedling[]>()
  for (const s of seedlings) {
    const group = byStatut.get(s.statut) ?? []
    group.push(s)
    byStatut.set(s.statut, group)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 56 }}>
        <Link
          href={`/${orgSlug}/m/saisie/semis`}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <span className="text-lg" style={{ color: '#2C3E2D' }}>←</span>
        </Link>
        <h1 className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          Avancement semis
        </h1>
      </div>

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading && (
          <p className="text-sm text-center py-8" style={{ color: '#6B7B6C' }}>
            Chargement…
          </p>
        )}

        {!isLoading && seedlings.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: '#6B7B6C' }}>
            Aucun semis en cache. Connectez-vous au réseau pour synchroniser.
          </p>
        )}

        {!isLoading && STATUT_ORDER.map((statut) => {
          const group = byStatut.get(statut)
          if (!group || group.length === 0) return null
          const advanceable = ADVANCEABLE_STATUTS.has(statut)
          const colors = STATUT_COLORS[statut] ?? STATUT_COLORS.semis

          return (
            <div key={statut} className="mb-4">
              {/* En-tête de groupe */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.bg, color: colors.color }}
                >
                  {SEEDLING_STATUT_LABELS[statut] ?? statut}
                </span>
                <span className="text-xs" style={{ color: '#9CA89D' }}>
                  ({group.length})
                </span>
              </div>

              {/* Liste des semis */}
              <div className="flex flex-col gap-2">
                {group.map((s) => (
                  <SeedlingCard
                    key={s.id}
                    seedling={s}
                    advanceable={advanceable}
                    onAdvance={() => setSelected(s)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Sous-composant : carte d'un semis ---

function SeedlingCard({
  seedling,
  advanceable,
  onAdvance,
}: {
  seedling: CachedSeedling
  advanceable: boolean
  onAdvance: () => void
}) {
  const isMM = seedling.processus === 'mini_motte'
  const [y, m, d] = (seedling.date_semis ?? '').split('-')
  const dateStr = d && m && y ? `${d}/${m}/${y}` : '—'

  return (
    <div
      className="rounded-xl p-3 bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#2C3E2D' }}>
            {seedling.variety_name ?? 'Variété inconnue'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6B7B6C' }}>
            {isMM ? 'MM' : 'CG'}
            {seedling.numero_caisse ? ` · Caisse ${seedling.numero_caisse}` : ''}
            {' · '}{dateStr}
            {seedling.nb_plants_obtenus != null && (
              <> · {seedling.plants_restants ?? seedling.nb_plants_obtenus} plants dispo</>
            )}
          </p>
        </div>

        {advanceable && (
          <button
            type="button"
            onClick={onAdvance}
            className="ml-2 flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Avancer
          </button>
        )}
      </div>
    </div>
  )
}
