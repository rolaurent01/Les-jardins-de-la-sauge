'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Variety, PartiePlante, ActionResult, StockLevel } from '@/lib/types'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import { PARTIE_COLORS } from '@/lib/utils/colors'
import { formatDate } from '@/lib/utils/format'
import { ETAT_PLANTE_LABELS } from '@/components/transformation/types'
import type { StockAdjustmentWithVariety } from '@/lib/types'
import AjustementSlideOver from './AjustementSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'
import YearFilter from '@/components/shared/YearFilter'

const AJUSTEMENTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'varieties', label: 'Variété', format: (v) => (v as { nom_vernaculaire?: string } | null)?.nom_vernaculaire ?? '' },
  { key: 'partie_plante', label: 'Partie' },
  { key: 'etat_plante', label: 'État' },
  { key: 'type_mouvement', label: 'Type', format: (v) => v === 'entree' ? 'Entrée' : 'Sortie' },
  { key: 'date', label: 'Date' },
  { key: 'poids_g', label: 'Poids (g)' },
  { key: 'motif', label: 'Motif' },
  { key: 'commentaire', label: 'Commentaire' },
]


function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  return `${g} g`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

type TypeFilter = 'all' | 'entree' | 'sortie'

type Props = {
  adjustments: StockAdjustmentWithVariety[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]
  stockLevels: StockLevel[]
  actions: {
    create: (fd: FormData) => Promise<ActionResult>
    update: (id: string, fd: FormData) => Promise<ActionResult>
    delete: (id: string) => Promise<ActionResult>
  }
}

export default function AjustementsClient({ adjustments: initialAdjustments, varieties, stockLevels, actions }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [etatFilter, setEtatFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [slideOverType, setSlideOverType] = useState<'entree' | 'sortie'>('entree')
  const [editingItem, setEditingItem] = useState<StockAdjustmentWithVariety | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setAdjustments(initialAdjustments) }, [initialAdjustments])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  const availableYears = Array.from(new Set(
    adjustments.map(a => a.date ? new Date(a.date).getFullYear() : null).filter((y): y is number => y !== null)
  )).sort((a, b) => b - a)

  const displayed = adjustments.filter(item => {
    if (yearFilter && item.date && new Date(item.date).getFullYear() !== yearFilter) return false
    if (typeFilter !== 'all' && item.type_mouvement !== typeFilter) return false
    if (etatFilter !== 'all' && item.etat_plante !== etatFilter) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (item.varieties?.nom_vernaculaire && normalize(item.varieties.nom_vernaculaire).includes(q)) ||
      (item.motif && normalize(item.motif).includes(q)) ||
      (item.commentaire && normalize(item.commentaire).includes(q))
    )
  })

  function openCreate() {
    setEditingItem(null)
    setSlideOverType('entree')
    setSlideOverOpen(true)
  }

  function openEdit(item: StockAdjustmentWithVariety) {
    setEditingItem(item)
    setSlideOverType(item.type_mouvement)
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

  function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null)
      setPendingId(id)
      startTransition(async () => {
        await actions.delete(id)
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
            Ajustements de stock
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {adjustments.length} enregistrement{adjustments.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed as unknown as Record<string, unknown>[]}
            columns={AJUSTEMENTS_EXPORT_COLUMNS}
            filename="ajustements"
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            + Nouvel ajustement
          </button>
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
            placeholder="Rechercher par variete, motif…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtre type */}
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

        {/* Filtre etat */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'Tous etats' },
            ...Object.entries(ETAT_PLANTE_LABELS).map(([k, v]) => ({ value: k, label: v })),
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setEtatFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: etatFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color: etatFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                border: etatFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
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
          <div className="text-3xl mb-2">📦</div>
          <p className="text-sm">
            {search || typeFilter !== 'all' || etatFilter !== 'all'
              ? 'Aucun resultat ne correspond aux filtres.'
              : 'Aucun ajustement enregistre.'}
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
                <Th>Motif</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item, i) => {
                const isDeleting = pendingId === item.id
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
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type_mouvement} />
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {item.varieties?.nom_vernaculaire ?? <Dash />}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: partieStyle.bg, color: partieStyle.color }}
                      >
                        {PARTIE_PLANTE_LABELS[partie] ?? partie}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {ETAT_PLANTE_LABELS[item.etat_plante] ?? item.etat_plante}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#2C3E2D' }}>
                      {formatWeight(item.poids_g)}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#9CA89D', fontStyle: 'italic' }}>
                      {item.motif ? truncate(item.motif, 40) : <Dash />}
                    </td>
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

      {/* Slide-over */}
      <AjustementSlideOver
        key={editingItem?.id ?? `new-${slideOverType}`}
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        type={slideOverType}
        onTypeChange={setSlideOverType}
        item={editingItem}
        varieties={varieties}
        stockLevels={stockLevels}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */

function TypeBadge({ type }: { type: 'entree' | 'sortie' }) {
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
