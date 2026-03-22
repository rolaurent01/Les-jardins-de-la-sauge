'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Variety, PartiePlante, TransformationType } from '@/lib/types'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import { PARTIE_COLORS } from '@/lib/utils/colors'
import { formatDate, formatDuration } from '@/lib/utils/format'
import type {
  TransformationModuleConfig,
  TransformationItem,
  TransformationActions,
} from './types'
import { ETAT_PLANTE_LABELS } from './types'
import TransformationSlideOver from './TransformationSlideOver'
import CombinedTransformationSlideOver from './CombinedTransformationSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'
import YearFilter from '@/components/shared/YearFilter'

/** Formate un poids en g ou kg */
function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  return `${g} g`
}

/** Tronque un texte a n caracteres */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

const TRANSFORMATION_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'type', label: 'Type', format: (v) => v === 'entree' ? 'Entrée' : 'Sortie' },
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'partie_plante', label: 'Partie' },
  { key: 'etat_plante', label: 'État' },
  { key: 'date', label: 'Date' },
  { key: 'poids_g', label: 'Poids (g)' },
  { key: 'temps_min', label: 'Temps (min)' },
  { key: 'commentaire', label: 'Commentaire' },
]

type TypeFilter = 'all' | 'entree' | 'sortie'

type Props = {
  config: TransformationModuleConfig
  items: TransformationItem[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  actions: TransformationActions
}

export default function TransformationClient({ config, items: initialItems, varieties, actions }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [slideOverType, setSlideOverType] = useState<TransformationType>('entree')
  const [editingItem, setEditingItem] = useState<TransformationItem | null>(null)
  const [combinedSlideOverOpen, setCombinedSlideOverOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setItems(initialItems) }, [initialItems])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  /** Resolve l'etat plante affiche pour un item */
  function getEtatLabel(item: TransformationItem): string {
    if (config.etatsEntree === null) {
      // Tronconnage : etat implicite
      return ETAT_PLANTE_LABELS[
        item.type === 'entree' ? config.etatEntreeImplicite! : config.etatSortieImplicite!
      ] ?? '—'
    }
    return ETAT_PLANTE_LABELS[item.etat_plante ?? ''] ?? '—'
  }

  // Années disponibles
  const availableYears = Array.from(new Set(
    items.map(i => i.date ? new Date(i.date).getFullYear() : null).filter((y): y is number => y !== null)
  )).sort((a, b) => b - a)

  const displayed = items.filter(item => {
    if (yearFilter && item.date && new Date(item.date).getFullYear() !== yearFilter) return false
    const matchType = typeFilter === 'all' || item.type === typeFilter
    if (!matchType) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (item.varieties?.nom_vernaculaire && normalize(item.varieties.nom_vernaculaire).includes(q)) ||
      (item.commentaire && normalize(item.commentaire).includes(q)) ||
      (item.etat_plante && normalize(item.etat_plante).includes(q))
    )
  })

  function openCreate(type: TransformationType) {
    setEditingItem(null)
    setSlideOverType(type)
    setSlideOverOpen(true)
  }

  function openEdit(item: TransformationItem) {
    setEditingItem(item)
    setSlideOverType(item.type)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingItem) return actions.update(editingItem.id, formData)
    return actions.create(formData)
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  function handleDeleteClick(id: string, pairedId?: string | null) {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null)
      setPendingId(id)
      startTransition(async () => {
        // Mode combine avec paired : suppression groupee
        if (config.combined && actions.deletePaired) {
          await actions.deletePaired(id)
        } else {
          await actions.delete(id)
        }
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
            {config.titre}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {items.length} enregistrement{items.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={TRANSFORMATION_EXPORT_COLUMNS}
            filename={config.module}
            variant="compact"
          />
          {config.combined ? (
            <button
              onClick={() => setCombinedSlideOverOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
            >
              + {config.titre}
            </button>
          ) : (
            <>
              <button
                onClick={() => openCreate('entree')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
              >
                <span className="text-base leading-none">↓</span>
                + Entree
              </button>
              <button
                onClick={() => openCreate('sortie')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{ backgroundColor: '#DDA15E', color: '#F9F8F6' }}
              >
                <span className="text-base leading-none">↑</span>
                + Sortie
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtre par année */}
      {availableYears.length > 1 && (
        <div className="mb-4">
          <YearFilter years={availableYears} selectedYear={yearFilter} onChange={setYearFilter} />
        </div>
      )}

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
            placeholder="Rechercher par variete, commentaire…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
            aria-label="Rechercher"
          />
        </div>

        {/* Filtres type */}
        <div className="flex gap-1">
          {([
            { value: 'all', label: 'Tous' },
            { value: 'entree', label: '🟢 Entrees' },
            { value: 'sortie', label: '🔴 Sorties' },
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
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🔄</div>
          <p className="text-sm">
            {search || typeFilter !== 'all'
              ? 'Aucun resultat ne correspond aux filtres.'
              : `Aucun ${config.titreSingulier} enregistre.`}
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
                <Th>Etat</Th>
                <Th>Date</Th>
                <Th>Poids</Th>
                <Th>Temps</Th>
                <Th>Commentaire</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, i) => {
                const isDeleting = pendingId === item.id || (item.paired_id != null && pendingId === item.paired_id)
                const isConfirming = confirmDeleteId === item.id
                const partie = item.partie_plante as PartiePlante
                const partieStyle = PARTIE_COLORS[partie] ?? PARTIE_COLORS.plante_entiere

                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isDeleting ? 0.4 : 1,
                    }}
                  >
                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type} />
                    </td>

                    {/* Variete */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {item.varieties?.nom_vernaculaire ?? <Dash />}
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

                    {/* Etat */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {getEtatLabel(item)}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(item.date)}
                    </td>

                    {/* Poids */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#2C3E2D' }}>
                      {formatWeight(item.poids_g)}
                    </td>

                    {/* Temps */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7B6C' }}>
                      {formatDuration(item.temps_min)}
                    </td>

                    {/* Commentaire */}
                    <td className="px-4 py-3" style={{ color: '#9CA89D', fontStyle: 'italic' }}>
                      {item.commentaire ? truncate(item.commentaire, 40) : <Dash />}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(item.id)}
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
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item.id)}
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

      {/* Slide-over edition individuelle */}
      <TransformationSlideOver
        key={editingItem?.id ?? `new-${slideOverType}`}
        config={config}
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        type={slideOverType}
        item={editingItem}
        varieties={varieties}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />

      {/* Slide-over creation combinee (tronconnage / triage) */}
      {config.combined && actions.createCombined && (
        <CombinedTransformationSlideOver
          config={config}
          open={combinedSlideOverOpen}
          onClose={() => setCombinedSlideOverOpen(false)}
          varieties={varieties}
          onSubmit={actions.createCombined}
          onSuccess={() => {
            setCombinedSlideOverOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */

function TypeBadge({ type }: { type: TransformationType }) {
  const styles = {
    entree: { label: '🟢 Entree', bg: '#DCFCE7', color: '#166534' },
    sortie: { label: '🔴 Sortie', bg: '#FEF3C7', color: '#92400E' },
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
