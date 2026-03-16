'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductStockMovementWithRelations, ProductStockSummary } from '@/lib/types'
import { deleteProductStockMovement } from '@/app/[orgSlug]/(dashboard)/produits/stock/actions'
import ProductStockSlideOver from './ProductStockSlideOver'
import ExportButton from '@/components/shared/ExportButton'
import type { ExportColumn } from '@/components/shared/ExportButton'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

const PRODUCT_STOCK_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'production_lots', label: 'N° Lot', format: (v) => (v as { numero_lot?: string } | null)?.numero_lot ?? '' },
  { key: '_recipe_nom', label: 'Recette' },
  { key: 'type_mouvement', label: 'Type', format: (v) => v === 'entree' ? 'Entrée' : 'Sortie' },
  { key: 'date', label: 'Date' },
  { key: 'quantite', label: 'Quantité' },
  { key: 'commentaire', label: 'Commentaire' },
]

type TypeFilter = 'all' | 'entree' | 'sortie'

type LotForSelect = {
  id: string
  numero_lot: string
  nb_unites: number | null
  recipe_nom: string
}

type Props = {
  initialMovements: ProductStockMovementWithRelations[]
  initialSummary: ProductStockSummary[]
  lots: LotForSelect[]
}

export default function ProductStockClient({ initialMovements, initialSummary, lots }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [movements, setMovements] = useState(initialMovements)
  const [summary, setSummary] = useState(initialSummary)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setMovements(initialMovements) }, [initialMovements])
  useEffect(() => { setSummary(initialSummary) }, [initialSummary])

  useEffect(() => {
    if (!confirmDeleteId) return
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteId])

  // Calcul du stock net par lot (pour le slide-over)
  const stockByLot = new Map<string, number>()
  for (const s of summary) {
    stockByLot.set(s.production_lot_id, s.stock_net)
  }

  // Filtrage des mouvements
  const displayed = movements.filter(m => {
    if (typeFilter !== 'all' && m.type_mouvement !== typeFilter) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      (m.production_lots?.numero_lot && normalize(m.production_lots.numero_lot).includes(q)) ||
      (m.production_lots?.recipes?.nom && normalize(m.production_lots.recipes.nom).includes(q)) ||
      (m.commentaire && normalize(m.commentaire).includes(q))
    )
  })

  function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null)
      setPendingId(id)
      startTransition(async () => {
        await deleteProductStockMovement(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmDeleteId(id)
    }
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Stock produits finis
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {summary.reduce((acc, s) => acc + s.stock_net, 0)} sachet(s) en stock total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            data={displayed.map(m => ({ ...m, _recipe_nom: m.production_lots?.recipes?.nom ?? '' })) as unknown as Record<string, unknown>[]}
            columns={PRODUCT_STOCK_EXPORT_COLUMNS}
            filename="stock_produits_finis"
            variant="compact"
          />
          <button
            onClick={() => setSlideOverOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
          >
            <span className="text-base leading-none">+</span>
            Mouvement de stock
          </button>
        </div>
      </div>

      {/* Section haute : Resume stock par lot */}
      {summary.length > 0 && (
        <div className="mb-8">
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: '#6B7B6C' }}
          >
            Stock actuel par lot
          </h2>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                  <Th>N° lot</Th>
                  <Th>Recette</Th>
                  <Th>Produit</Th>
                  <Th>Stock actuel</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr
                    key={s.production_lot_id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                    }}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#2C3E2D' }}>
                      {s.numero_lot}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#2C3E2D' }}>
                      {s.recipe_nom}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: '#6B7B6C' }}>
                      {s.nb_unites_produites != null ? `${s.nb_unites_produites} sachets` : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#2C3E2D' }}>
                      {s.stock_net}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: s.stock_net > 0 ? '#DCFCE7' : '#F3F4F6',
                          color: s.stock_net > 0 ? '#166534' : '#6B7280',
                        }}
                      >
                        {s.stock_net > 0 ? 'En stock' : 'Epuise'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            placeholder="Rechercher par lot, recette…"
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
            { value: 'entree', label: 'Entrees' },
            { value: 'sortie', label: 'Sorties' },
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

      {/* Tableau mouvements */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">📦</div>
          <p className="text-sm">
            {search || typeFilter !== 'all'
              ? 'Aucun mouvement ne correspond aux filtres.'
              : 'Aucun mouvement de stock. Les entrees se creent automatiquement a la production.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Type</Th>
                <Th>Lot</Th>
                <Th>Recette</Th>
                <Th>Date</Th>
                <Th>Quantite</Th>
                <Th>Commentaire</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((m, i) => {
                const isDeleting = pendingId === m.id
                const isConfirming = confirmDeleteId === m.id
                const isEntree = m.type_mouvement === 'entree'

                return (
                  <tr
                    key={m.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isDeleting ? 0.4 : 1,
                    }}
                  >
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: isEntree ? '#DCFCE7' : '#FEE2E2',
                          color: isEntree ? '#166534' : '#991B1B',
                        }}
                      >
                        {isEntree ? 'Entree' : 'Sortie'}
                      </span>
                    </td>

                    {/* Lot */}
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#2C3E2D' }}>
                      {m.production_lots?.numero_lot ?? '—'}
                    </td>

                    {/* Recette */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {m.production_lots?.recipes?.nom ?? '—'}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {new Date(m.date).toLocaleDateString('fr-FR')}
                    </td>

                    {/* Quantite */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {m.quantite}
                    </td>

                    {/* Commentaire */}
                    <td
                      className="px-4 py-3 truncate max-w-[200px]"
                      style={{ color: '#6B7B6C' }}
                      title={m.commentaire ?? ''}
                    >
                      {m.commentaire || <Dash />}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteClick(m.id)}
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
                          <button
                            onClick={() => handleDeleteClick(m.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            title="Supprimer"
                            style={{ color: '#9CA89D' }}
                            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                          >
                            🗑️
                          </button>
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
      <ProductStockSlideOver
        open={slideOverOpen}
        lots={lots}
        stockByLot={stockByLot}
        onClose={() => setSlideOverOpen(false)}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}
