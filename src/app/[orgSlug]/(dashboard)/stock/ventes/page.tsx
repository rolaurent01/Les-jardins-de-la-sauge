import { fetchDirectSales, createDirectSale, updateDirectSale, deleteDirectSale } from './actions'
import { fetchVarietiesForAffinage, fetchStockLevelsForAffinage } from '../shared-actions'
import VentesClient from '@/components/affinage-stock/VentesClient'

export const metadata = { title: 'Ventes directes — LJS' }

export default async function VentesPage() {
  try {
    const [sales, varieties, stockLevels] = await Promise.all([
      fetchDirectSales(),
      fetchVarietiesForAffinage(),
      fetchStockLevelsForAffinage(),
    ])

    return (
      <VentesClient
        sales={sales}
        varieties={varieties}
        stockLevels={stockLevels}
        actions={{ create: createDirectSale, update: updateDirectSale, delete: deleteDirectSale }}
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
