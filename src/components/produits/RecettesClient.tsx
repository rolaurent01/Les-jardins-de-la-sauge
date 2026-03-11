'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RecipeWithRelations, ProductCategory, Variety, ExternalMaterial } from '@/lib/types'
import {
  createRecipe,
  updateRecipe,
  archiveRecipe,
  restoreRecipe,
  toggleRecipeActive,
} from '@/app/[orgSlug]/(dashboard)/produits/recettes/actions'
import RecetteSlideOver from './RecetteSlideOver'

/** Normalise une chaine pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Couleurs de badge par categorie */
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  'Tisane':  { bg: '#DCFCE7', color: '#166534' },
  'Aromate': { bg: '#FEF3C7', color: '#92400E' },
  'Sel':     { bg: '#E8DECF', color: '#78350F' },
  'Sucre':   { bg: '#FCE7F3', color: '#9D174D' },
  'Sirop':   { bg: '#DBEAFE', color: '#1E40AF' },
}
const DEFAULT_CATEGORY_COLOR = { bg: '#F3F4F6', color: '#6B7280' }

/** Resume textuel des ingredients (max 3 affiches) */
function ingredientsSummary(recipe: RecipeWithRelations): string {
  const sorted = [...recipe.recipe_ingredients].sort((a, b) => b.pourcentage - a.pourcentage)
  const shown = sorted.slice(0, 3)
  const parts = shown.map(ing => {
    const name = ing.varieties?.nom_vernaculaire ?? ing.external_materials?.nom ?? '?'
    return `${name} ${Math.round(ing.pourcentage * 100)}%`
  })
  if (sorted.length > 3) parts.push('…')
  return parts.join(', ')
}

type StatusFilter = 'all' | 'active' | 'inactive'

type Props = {
  initialRecipes: RecipeWithRelations[]
  categories: ProductCategory[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]
  materials: Pick<ExternalMaterial, 'id' | 'nom'>[]
}

export default function RecettesClient({ initialRecipes, categories, varieties, materials }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [recipes, setRecipes] = useState(initialRecipes)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithRelations | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => { setRecipes(initialRecipes) }, [initialRecipes])

  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active = recipes.filter(r => !r.deleted_at)
  const archived = recipes.filter(r => !!r.deleted_at)

  const displayed = (showArchived ? archived : active).filter(r => {
    // Filtre categorie
    if (categoryFilter !== 'all') {
      const catName = r.product_categories?.nom ?? ''
      if (catName !== categoryFilter) return false
    }
    // Filtre statut actif/inactif
    if (statusFilter === 'active' && !r.actif) return false
    if (statusFilter === 'inactive' && r.actif) return false
    // Recherche textuelle
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(r.nom).includes(q) ||
      (r.description && normalize(r.description).includes(q)) ||
      (r.numero_tisane && normalize(r.numero_tisane).includes(q)) ||
      r.recipe_ingredients.some(ing =>
        (ing.varieties?.nom_vernaculaire && normalize(ing.varieties.nom_vernaculaire).includes(q)) ||
        (ing.external_materials?.nom && normalize(ing.external_materials.nom).includes(q))
      )
    )
  })

  function openCreate() {
    setEditingRecipe(null)
    setSlideOverOpen(true)
  }

  function openEdit(r: RecipeWithRelations) {
    setEditingRecipe(r)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingRecipe) return updateRecipe(editingRecipe.id, formData)
    return createRecipe(formData)
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  function handleArchiveClick(id: string) {
    if (confirmArchiveId === id) {
      setConfirmArchiveId(null)
      setPendingId(id)
      startTransition(async () => {
        await archiveRecipe(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmArchiveId(id)
    }
  }

  function handleRestore(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await restoreRecipe(id)
      setPendingId(null)
      router.refresh()
    })
  }

  function handleToggleActive(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await toggleRecipeActive(id)
      setPendingId(null)
      router.refresh()
    })
  }

  // Categories presentes dans les recettes actives (pour les filtres)
  const usedCategories = [...new Set(active.map(r => r.product_categories?.nom).filter(Boolean))] as string[]

  return (
    <div className="p-8">
      {/* En-tete */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Recettes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} recette{active.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">+</span>
          Nouvelle recette
        </button>
      </div>

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
            placeholder="Rechercher par nom, ingredient…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {/* Filtres categorie */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'Toutes' },
            ...usedCategories.map(c => ({ value: c, label: c })),
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setCategoryFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: categoryFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color: categoryFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                border: categoryFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtre actif/inactif */}
        <div className="flex gap-1">
          {([
            { value: 'all', label: 'Tous' },
            { value: 'active', label: 'Actives' },
            { value: 'inactive', label: 'Inactives' },
          ] as { value: StatusFilter; label: string }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: statusFilter === f.value ? 'var(--color-primary)' : 'transparent',
                color: statusFilter === f.value ? '#F9F8F6' : '#6B7B6C',
                border: statusFilter === f.value ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Toggle archives */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: showArchived ? '#FEF3C7' : 'transparent',
            color: showArchived ? '#92400E' : '#9CA89D',
            border: `1px solid ${showArchived ? '#F59E0B44' : '#D8E0D9'}`,
          }}
        >
          {showArchived ? `Archives (${archived.length})` : 'Voir archives'}
        </button>
      </div>

      {/* Tableau */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🧪</div>
          <p className="text-sm">
            {search || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Aucune recette ne correspond aux filtres.'
              : showArchived
                ? 'Aucune recette archivee.'
                : 'Aucune recette. Commencez par en creer une.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Nom</Th>
                <Th>Categorie</Th>
                <Th>Ref Produit</Th>
                <Th>Poids sachet</Th>
                <Th>Ingredients</Th>
                <Th>Statut</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => {
                const isArchiving = pendingId === r.id
                const isConfirming = confirmArchiveId === r.id
                const catName = r.product_categories?.nom ?? ''
                const catColor = CATEGORY_COLORS[catName] ?? DEFAULT_CATEGORY_COLOR

                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => !showArchived && openEdit(r)}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isArchiving ? 0.4 : 1,
                    }}
                  >
                    {/* Nom */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {r.nom}
                    </td>

                    {/* Categorie */}
                    <td className="px-4 py-3">
                      {catName ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: catColor.bg, color: catColor.color }}
                        >
                          {catName}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>

                    {/* Ref Produit */}
                    <td className="px-4 py-3" style={{ color: '#2C3E2D' }}>
                      {r.numero_tisane || <Dash />}
                    </td>

                    {/* Poids sachet */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#2C3E2D' }}>
                      {r.poids_sachet_g} g
                    </td>

                    {/* Ingredients */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C', maxWidth: '280px' }}>
                      <span className="font-medium" style={{ color: '#2C3E2D' }}>
                        {r.recipe_ingredients.length}
                      </span>
                      {' — '}
                      <span className="truncate inline-block max-w-[200px] align-bottom">
                        {ingredientsSummary(r)}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: r.actif ? '#DCFCE7' : '#F3F4F6',
                          color: r.actif ? '#166534' : '#6B7280',
                        }}
                      >
                        {r.actif ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {showArchived ? (
                          <button
                            onClick={() => handleRestore(r.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(r.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#DC2626', color: '#FFF' }}
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmArchiveId(null)}
                              className="px-2.5 py-1 rounded-lg text-xs border"
                              style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(r)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleToggleActive(r.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              title={r.actif ? 'Desactiver' : 'Activer'}
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              {r.actif ? '⏸️' : '▶️'}
                            </button>
                            <button
                              onClick={() => handleArchiveClick(r.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Archiver"
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
      <RecetteSlideOver
        key={editingRecipe?.id ?? 'new'}
        open={slideOverOpen}
        recipe={editingRecipe}
        categories={categories}
        varieties={varieties}
        materials={materials}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
      style={{ color: '#9CA89D', textAlign: align }}
    >
      {children}
    </th>
  )
}

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}
