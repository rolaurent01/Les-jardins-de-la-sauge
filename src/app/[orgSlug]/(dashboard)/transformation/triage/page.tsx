import { fetchSortings, createSorting, updateSorting, deleteSorting, createSortingCombined, updateSortingCombined, deleteSortingPaired } from './actions'
import { fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import { fetchStockForTransformation } from '@/app/[orgSlug]/(dashboard)/stock/vue-stock/actions'
import TransformationClient from '@/components/transformation/TransformationClient'
import { TRIAGE_CONFIG } from '@/components/transformation/types'
import type { TransformationItem } from '@/components/transformation/types'

export const metadata = { title: 'Triage — Carnet Culture' }

export default async function TriagePage() {
  try {
    const [items, varieties, stockEntries] = await Promise.all([
      fetchSortings(),
      fetchVarietiesForSelect(),
      fetchStockForTransformation(['sechee', 'tronconnee_sechee']),
    ])

    return (
      <TransformationClient
        config={TRIAGE_CONFIG}
        items={items as unknown as TransformationItem[]}
        varieties={varieties}
        stockEntries={stockEntries}
        actions={{ create: createSorting, update: updateSorting, delete: deleteSorting, createCombined: createSortingCombined, updateCombined: updateSortingCombined, deletePaired: deleteSortingPaired }}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement :{' '}
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }
}
