import { fetchPurchases, createPurchase, updatePurchase, deletePurchase } from './actions'
import { fetchVarietiesForAffinage, fetchStockLevelsForAffinage } from '../shared-actions'
import AchatsClient from '@/components/affinage-stock/AchatsClient'

export const metadata = { title: 'Achats — LJS' }

export default async function AchatsPage() {
  try {
    const [purchases, varieties, stockLevels] = await Promise.all([
      fetchPurchases(),
      fetchVarietiesForAffinage(),
      fetchStockLevelsForAffinage(),
    ])

    return (
      <AchatsClient
        purchases={purchases}
        varieties={varieties}
        stockLevels={stockLevels}
        actions={{ create: createPurchase, update: updatePurchase, delete: deletePurchase }}
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
