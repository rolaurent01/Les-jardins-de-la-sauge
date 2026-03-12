'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductionLotWithRelations, ProductCategory, StockLevel, ProductionMode } from '@/lib/types'
import type { RecipeForSelect } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import {
  archiveProductionLot,
  restoreProductionLot,
  conditionnerLot,
} from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import { formatDate, formatDuration } from '@/lib/utils/format'
import { MODE_LABELS } from './types'
import ProductionWizard from './ProductionWizard'
import ConditionnerModal from './ConditionnerModal'
import ProductionLotDetail from './ProductionLotDetail'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'

/** Normalise une chaine pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Formate un poids en grammes de facon lisible */
function formatWeight(g: number | null): string {
  if (g == null) return '—'
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

const MODE_BADGE: Record<ProductionMode, { bg: string; color: string }> = {
  produit: { bg: '#DCFCE7', color: '#166534' },
  melange: { bg: '#FEF3C7', color: '#92400E' },
}

const PRODUCTION_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'numero_lot', label: 'N° Lot' },
  { key: 'recipes', label: 'Recette', format: (v) => (v as { nom?: string } | null)?.nom ?? '' },
  { key: 'mode', label: 'Mode' },
  { key: 'date_production', label: 'Date production' },
  { key: 'ddm', label: 'DDM' },
  { key: 'nb_unites', label: 'Nb unités' },
  { key: 'poids_total_g', label: 'Poids total (g)' },
  { key: 'temps_min', label: 'Temps (min)' },
  { key: 'commentaire', label: 'Commentaire' },
]

type ModeFilter = 'all' | 'produit' | 'melange'

type Props = {
  initialLots: ProductionLotWithRelations[]
  recipes: RecipeForSelect[]
  categories: ProductCategory[]
  stockLevels: StockLevel[]
}

export default function ProductionClient({ initialLots, recipes, categories, stockLevels }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [lots, setLots] = useState(initialLots)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [conditionnerLotId, setConditionnerLotId] = useState<string | null>(null)
  const [detailLot, setDetailLot] = useState<ProductionLotWithRelations | null>(null)

  useEffect(() => { setLots(initialLots) }, [initialLots])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active = lots.filter(l => !l.deleted_at)
  const archived = lots.filter(l => !!l.deleted_at)

  const displayed = (showArchived ? archived : active).filter(l => {
    if (modeFilter !== 'all' && l.mode !== modeFilter) return false
    if (categoryFilter !== 'all') {
      const recipeName = l.recipes?.nom ?? ''
      const recipe = recipes.find(r => r.nom === recipeName)
      if (!recipe || recipe.category_id !== categoryFilter) return false
    }
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(l.numero_lot).includes(q) ||
      (l.recipes?.nom && normalize(l.recipes.nom).includes(q))
    )
  })

  function handleArchiveClick(id: string) {
    if (confirmArchiveId === id) {
      setConfirmArchiveId(null)
      setPendingId(id)
      startTransition(async () => {
        await archiveProductionLot(id)
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
      const result = await restoreProductionLot(id)
      setPendingId(null)
      if ('error' in result) {
        alert(result.error)
      }
      router.refresh()
    })
  }

  function handleConditionnerSuccess() {
    setConditionnerLotId(null)
    router.refresh()
  }

  function handleWizardSuccess() {
    setWizardOpen(false)
    router.refresh()
  }

  // Categories utilisees dans les recettes (pour les filtres)
  const usedCategories = categories.filter(c =>
    recipes.some(r => r.category_id === c.id),
  )

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Production
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} lot{active.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={PRODUCTION_EXPORT_COLUMNS}
            filename="production_lots"
            variant="compact"
          />
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">+</span>
            Produire un lot
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
            placeholder="Rechercher par n° lot, recette…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtres categorie */}
        {usedCategories.length > 0 && (
          <div className="flex gap-1">
            {[{ value: 'all', label: 'Toutes' }, ...usedCategories.map(c => ({ value: c.id, label: c.nom }))].map(f => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: categoryFilter === f.value ? 'var(--color-primary)' : 'transparent',
                  color: categoryFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                  border: categoryFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Filtre mode */}
        <div className="flex gap-1">
          {([
            { value: 'all', label: 'Tous' },
            { value: 'produit', label: 'Produit' },
            { value: 'melange', label: 'Melange' },
          ] as { value: ModeFilter; label: string }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setModeFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: modeFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color: modeFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                border: modeFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
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
          <div className="text-3xl mb-2">🏭</div>
          <p className="text-sm">
            {search || modeFilter !== 'all' || categoryFilter !== 'all'
              ? 'Aucun lot ne correspond aux filtres.'
              : showArchived
                ? 'Aucun lot archive.'
                : 'Aucun lot de production. Commencez par en produire un.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>N° lot</Th>
                <Th>Recette</Th>
                <Th>Mode</Th>
                <Th>Date prod.</Th>
                <Th>DDM</Th>
                <Th>Unites</Th>
                <Th>Poids total</Th>
                <Th>Temps</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((l, i) => {
                const isPending = pendingId === l.id
                const isConfirming = confirmArchiveId === l.id
                const modeBadge = MODE_BADGE[l.mode as ProductionMode] ?? MODE_BADGE.produit
                const needsConditionner = l.mode === 'melange' && l.nb_unites == null && !l.deleted_at

                return (
                  <tr
                    key={l.id}
                    className="cursor-pointer"
                    onClick={() => !showArchived && setDetailLot(l)}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isPending ? 0.4 : 1,
                    }}
                  >
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: '#2C3E2D' }}>
                      {l.numero_lot}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {l.recipes?.nom ?? <Dash />}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: modeBadge.bg, color: modeBadge.color }}
                      >
                        {MODE_LABELS[l.mode as ProductionMode] ?? l.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {formatDate(l.date_production)}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {formatDate(l.ddm)}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {l.nb_unites != null ? (
                        l.nb_unites
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                        >
                          A conditionner
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatWeight(l.poids_total_g)}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {formatDuration(l.temps_min)}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {showArchived ? (
                          <button
                            onClick={() => handleRestore(l.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(l.id)}
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
                              onClick={() => setDetailLot(l)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Voir le detail"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              👁️
                            </button>
                            {needsConditionner && (
                              <button
                                onClick={() => setConditionnerLotId(l.id)}
                                className="p-1.5 rounded-lg transition-colors"
                                title="Conditionner"
                                style={{ color: '#9CA89D' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#D97706')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                              >
                                📦
                              </button>
                            )}
                            <button
                              onClick={() => handleArchiveClick(l.id)}
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

      {/* Wizard de production (pleine page) */}
      {wizardOpen && (
        <ProductionWizard
          recipes={recipes}
          categories={categories}
          stockLevels={stockLevels}
          onClose={() => setWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}

      {/* Modal conditionner */}
      {conditionnerLotId && (
        <ConditionnerModal
          lotId={conditionnerLotId}
          onClose={() => setConditionnerLotId(null)}
          onSuccess={handleConditionnerSuccess}
        />
      )}

      {/* Slide-over detail lot */}
      <ProductionLotDetail
        lot={detailLot}
        open={detailLot !== null}
        onClose={() => setDetailLot(null)}
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
