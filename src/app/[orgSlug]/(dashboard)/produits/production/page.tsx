import { fetchProductionLots, fetchRecipesForSelect } from './actions'
import { fetchProductCategories, fetchStockLevels } from '@/app/[orgSlug]/(dashboard)/produits/shared-actions'
import ProductionClient from '@/components/produits/ProductionClient'

export const metadata = { title: 'Production — LJS' }

export default async function ProductionPage() {
  try {
    const [lots, recipes, categories, stockLevels] = await Promise.all([
      fetchProductionLots(),
      fetchRecipesForSelect(),
      fetchProductCategories(),
      fetchStockLevels(),
    ])

    return (
      <ProductionClient
        initialLots={lots}
        recipes={recipes}
        categories={categories}
        stockLevels={stockLevels}
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
