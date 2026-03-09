import {
  fetchProductStockMovements,
  fetchProductStockSummary,
  fetchProductionLotsForSelect,
} from './actions'
import ProductStockClient from '@/components/produits/ProductStockClient'

export const metadata = { title: 'Stock produits finis — LJS' }

export default async function ProductStockPage() {
  try {
    const [movements, summary, lots] = await Promise.all([
      fetchProductStockMovements(),
      fetchProductStockSummary(),
      fetchProductionLotsForSelect(),
    ])

    return (
      <ProductStockClient
        initialMovements={movements}
        initialSummary={summary}
        lots={lots}
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
