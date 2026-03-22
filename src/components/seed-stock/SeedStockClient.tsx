'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult, SeedStockAdjustmentWithRelations, SeedStockLevel } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import SeedAdjustmentSlideOver from './SeedAdjustmentSlideOver'

type SeedLotOption = {
  id: string
  lot_interne: string
  variety_id: string | null
  poids_sachet_g: number | null
  varieties: { id: string; nom_vernaculaire: string } | null
}

type Props = {
  stockLevels: SeedStockLevel[]
  adjustments: SeedStockAdjustmentWithRelations[]
  seedLots: SeedLotOption[]
  actions: {
    create: (fd: FormData) => Promise<ActionResult>
    update: (id: string, fd: FormData) => Promise<ActionResult>
    delete: (id: string) => Promise<ActionResult>
  }
}

type Tab = 'stock' | 'historique'

const STOCK_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'lot_interne', label: 'Lot' },
  { key: 'poids_initial_g', label: 'Poids initial (g)' },
  { key: 'stock_g', label: 'Stock restant (g)' },
]

const ADJUSTMENTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'seed_lots', label: 'Sachet', format: (v) => {
    const sl = v as { lot_interne?: string } | null
    return sl?.lot_interne ?? ''
  }},
  { key: 'date', label: 'Date' },
  { key: 'poids_constate_g', label: 'Poids constate (g)' },
  { key: 'commentaire', label: 'Commentaire' },
]

function formatWeight(g: number | null): string {
  if (g === null || g === undefined) return '—'
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`
  return `${g} g`
}

function StockBar({ initial, current }: { initial: number | null; current: number }) {
  if (!initial || initial <= 0) return null
  const pct = Math.max(0, Math.min(100, (current / initial) * 100))
  const color = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#DC2626'

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 rounded-full flex-1"
        style={{ backgroundColor: '#E5E7EB', maxWidth: 80 }}
      >
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs" style={{ color: '#9CA89D' }}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

export default function SeedStockClient({ stockLevels: initialStockLevels, adjustments: initialAdjustments, seedLots, actions }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [stockLevels, setStockLevels] = useState(initialStockLevels)
  const [adjustments, setAdjustments] = useState(initialAdjustments)
  const [tab, setTab] = useState<Tab>('stock')
  const [search, setSearch] = useState('')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SeedStockAdjustmentWithRelations | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setStockLevels(initialStockLevels) }, [initialStockLevels])
  useEffect(() => { setAdjustments(initialAdjustments) }, [initialAdjustments])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  // Filtrage stock
  const displayedStock = stockLevels.filter(item => {
    if (!search.trim()) return true
    const q = normalize(search)
    return normalize(item.lot_interne).includes(q)
  })

  // Filtrage historique
  const displayedAdjustments = adjustments.filter(item => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (item.seed_lots?.lot_interne && normalize(item.seed_lots.lot_interne).includes(q)) ||
      (item.seed_lots?.varieties?.nom_vernaculaire && normalize(item.seed_lots.varieties.nom_vernaculaire).includes(q)) ||
      (item.commentaire && normalize(item.commentaire).includes(q))
    )
  })

  function openCreate() {
    setEditingItem(null)
    setSlideOverOpen(true)
  }

  function openEdit(item: SeedStockAdjustmentWithRelations) {
    setEditingItem(item)
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

  // Enrichir stock avec variete depuis seedLots
  function getVarietyName(seedLotId: string): string {
    const lot = seedLots.find(l => l.id === seedLotId)
    return lot?.varieties?.nom_vernaculaire ?? '—'
  }

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Stock de graines
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {stockLevels.length} sachet{stockLevels.length !== 1 ? 's' : ''} en stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={(tab === 'stock' ? displayedStock : displayedAdjustments) as unknown as Record<string, unknown>[]}
            columns={tab === 'stock' ? STOCK_EXPORT_COLUMNS : ADJUSTMENTS_EXPORT_COLUMNS}
            filename={tab === 'stock' ? 'stock-graines' : 'inventaires-graines'}
            variant="compact"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            + Inventaire
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-4">
        {([
          { value: 'stock' as Tab, label: 'Vue stock' },
          { value: 'historique' as Tab, label: 'Historique inventaires' },
        ]).map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.value ? 'var(--color-primary)' : 'transparent',
              color: tab === t.value ? '#F9F8F6' : '#6B7B6C',
              border: tab === t.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#9CA89D' }}
          >
            &#x1F50D;
          </span>
          <input
            type="text"
            placeholder="Rechercher par lot, variete…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>
      </div>

      {/* Contenu selon onglet */}
      {tab === 'stock' ? (
        <StockTable items={displayedStock} getVarietyName={getVarietyName} />
      ) : (
        <AdjustmentsTable
          items={displayedAdjustments}
          pendingId={pendingId}
          confirmDeleteId={confirmDeleteId}
          onEdit={openEdit}
          onDelete={handleDeleteClick}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Slide-over */}
      <SeedAdjustmentSlideOver
        key={editingItem?.id ?? 'new'}
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        item={editingItem}
        seedLots={seedLots}
        stockLevels={stockLevels}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants ---- */

function StockTable({ items, getVarietyName }: { items: SeedStockLevel[]; getVarietyName: (id: string) => string }) {
  if (items.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-xl border"
        style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
      >
        <div className="text-3xl mb-2">&#x1F331;</div>
        <p className="text-sm">Aucun sachet en stock.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
            <Th>Lot</Th>
            <Th>Variete</Th>
            <Th>Poids initial</Th>
            <Th>Stock restant</Th>
            <Th>Utilisation</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.seed_lot_id}
              style={{
                backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                borderBottom: '1px solid #EDE8E0',
              }}
            >
              <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                {item.lot_interne}
              </td>
              <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                {getVarietyName(item.seed_lot_id)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#9CA89D' }}>
                {formatWeight(item.poids_initial_g)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#2C3E2D' }}>
                {formatWeight(item.stock_g)}
              </td>
              <td className="px-4 py-3">
                <StockBar initial={item.poids_initial_g} current={item.stock_g} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdjustmentsTable({
  items,
  pendingId,
  confirmDeleteId,
  onEdit,
  onDelete,
  onCancelDelete,
}: {
  items: SeedStockAdjustmentWithRelations[]
  pendingId: string | null
  confirmDeleteId: string | null
  onEdit: (item: SeedStockAdjustmentWithRelations) => void
  onDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  if (items.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-xl border"
        style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
      >
        <div className="text-3xl mb-2">&#x1F4E6;</div>
        <p className="text-sm">Aucun inventaire enregistre.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
            <Th>Sachet</Th>
            <Th>Variete</Th>
            <Th>Date</Th>
            <Th>Poids constate</Th>
            <Th>Commentaire</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const isDeleting = pendingId === item.id
            const isConfirming = confirmDeleteId === item.id

            return (
              <tr
                key={item.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                  borderBottom: '1px solid #EDE8E0',
                  opacity: isDeleting ? 0.4 : 1,
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                  {item.seed_lots?.lot_interne ?? '—'}
                </td>
                <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                  {item.seed_lots?.varieties?.nom_vernaculaire ?? '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                  {formatDate(item.date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#2C3E2D' }}>
                  {formatWeight(item.poids_constate_g)}
                </td>
                <td className="px-4 py-3" style={{ color: '#9CA89D', fontStyle: 'italic' }}>
                  {item.commentaire ? truncate(item.commentaire, 40) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {isConfirming ? (
                      <>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#DC2626', color: '#FFF' }}
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={onCancelDelete}
                          className="px-2.5 py-1 rounded-lg text-xs border"
                          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 rounded-lg transition-colors"
                          title="Modifier"
                          style={{ color: '#9CA89D' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                        >
                          &#x270F;&#xFE0F;
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          title="Supprimer"
                          style={{ color: '#9CA89D' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                        >
                          &#x1F5D1;&#xFE0F;
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
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
