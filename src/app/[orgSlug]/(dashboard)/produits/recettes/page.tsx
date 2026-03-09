import { fetchRecipes } from './actions'
import { fetchProductCategories, fetchVarietiesWithStock, fetchExternalMaterials } from '@/app/[orgSlug]/(dashboard)/produits/shared-actions'
import RecettesClient from '@/components/produits/RecettesClient'

export const metadata = { title: 'Recettes — LJS' }

export default async function RecettesPage() {
  try {
    const [recipes, categories, varieties, materials] = await Promise.all([
      fetchRecipes(),
      fetchProductCategories(),
      fetchVarietiesWithStock(),
      fetchExternalMaterials(),
    ])

    return (
      <RecettesClient
        initialRecipes={recipes}
        categories={categories}
        varieties={varieties}
        materials={materials}
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
