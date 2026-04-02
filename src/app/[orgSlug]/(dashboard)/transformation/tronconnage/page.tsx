import { fetchCuttings, createCutting, updateCutting, deleteCutting, createCuttingCombined, updateCuttingCombined, deleteCuttingPaired } from './actions'
import { fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import { fetchStockForTransformation } from '@/app/[orgSlug]/(dashboard)/stock/vue-stock/actions'
import TransformationClient from '@/components/transformation/TransformationClient'
import { TRONCONNAGE_CONFIG } from '@/components/transformation/types'
import type { TransformationItem } from '@/components/transformation/types'

export const metadata = { title: 'Tronconnage — Carnet Culture' }

export default async function TronconnagePage() {
  try {
    const [items, varieties, stockEntries] = await Promise.all([
      fetchCuttings(),
      fetchVarietiesForSelect(),
      fetchStockForTransformation(['frais']),
    ])

    return (
      <TransformationClient
        config={TRONCONNAGE_CONFIG}
        items={items as unknown as TransformationItem[]}
        varieties={varieties}
        stockEntries={stockEntries}
        actions={{ create: createCutting, update: updateCutting, delete: deleteCutting, createCombined: createCuttingCombined, updateCombined: updateCuttingCombined, deletePaired: deleteCuttingPaired }}
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
