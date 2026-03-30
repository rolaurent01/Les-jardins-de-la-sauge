'use client'

import type { ProductionMode, ProductCategory } from '@/lib/types'
import type { RecipeForSelect } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import type { WizardState } from './ProductionWizard'
import { MODE_LABELS, MODE_DESCRIPTIONS } from './types'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'

type Props = {
  state: WizardState
  recipes: RecipeForSelect[]
  categories: ProductCategory[]
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}

/** Formate la date du jour en YYYY-MM-DD */
function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function WizardStepRecipe({ state, recipes, categories, onChange, onNext }: Props) {
  const recipe = recipes.find(r => r.id === state.recipe_id) ?? null

  function handleModeChange(mode: ProductionMode) {
    onChange({
      mode,
      nb_unites: mode === 'melange' ? null : state.nb_unites,
    })
  }

  function handleRecipeChange(recipeId: string) {
    const r = recipes.find(x => x.id === recipeId) ?? null
    if (!r) {
      onChange({ recipe_id: '', recipe: null, ingredients: [] })
      return
    }

    // Copier les ingredients de la recette dans le wizard
    const ingredients = r.recipe_ingredients
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map(ing => ({
        tempId: crypto.randomUUID(),
        variety_id: ing.variety_id ?? null,
        external_material_id: ing.external_material_id ?? null,
        variety_name: ing.varieties?.nom_vernaculaire ?? '',
        material_name: ing.external_materials?.nom ?? '',
        partie_plante: ing.partie_plante ?? null,
        etat_plante: ing.etat_plante ?? null,
        pourcentage: ing.pourcentage,
        poids_g: 0,
        annee_recolte: null,
        fournisseur: null,
        stock_disponible_g: null,
      }))

    onChange({ recipe_id: recipeId, recipe: r, ingredients })
  }

  function handleNbUnitesChange(val: string) {
    const n = parseInt(val, 10)
    const nbUnites = isNaN(n) || n <= 0 ? null : n
    const poidsTotal =
      nbUnites && recipe ? nbUnites * recipe.poids_sachet_g : null

    // Recalculer les poids des ingredients
    const updatedIngredients = state.ingredients.map(ing => ({
      ...ing,
      poids_g: poidsTotal ? Math.round(poidsTotal * ing.pourcentage * 100) / 100 : 0,
    }))

    onChange({
      nb_unites: nbUnites,
      poids_total_g: poidsTotal,
      ingredients: updatedIngredients,
    })
  }

  const canNext =
    state.recipe_id !== '' &&
    state.date_production !== '' &&
    (state.mode === 'melange' || (state.nb_unites != null && state.nb_unites > 0))

  const poidsTotal = state.poids_total_g

  return (
    <div className="space-y-6">
      {/* Section mode */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: '#2C3E2D' }}>
          Mode de production
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['produit', 'melange'] as ProductionMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className="p-4 rounded-xl border text-left transition-all"
              style={{
                borderColor: state.mode === m ? 'var(--color-primary)' : '#D8E0D9',
                backgroundColor: state.mode === m ? '#EDF5ED' : '#F9F8F6',
                borderWidth: state.mode === m ? '2px' : '1px',
              }}
            >
              <div className="font-medium text-sm" style={{ color: '#2C3E2D' }}>
                {MODE_LABELS[m]}
              </div>
              <div className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                {MODE_DESCRIPTIONS[m]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section recette */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
          Recette <span style={{ color: '#BC6C25' }}>*</span>
        </label>
        <select
          value={state.recipe_id}
          onChange={e => handleRecipeChange(e.target.value)}
          style={inputStyle}
          onFocus={focusStyle}
          onBlur={blurStyle}
        >
          <option value="">— Choisir une recette</option>
          {recipes.map(r => {
            const cat = categories.find(c => c.id === r.category_id)
            return (
              <option key={r.id} value={r.id}>
                {r.nom}{cat ? ` (${cat.nom})` : ''} — {r.poids_sachet_g}g
              </option>
            )
          })}
        </select>

        {/* Resume composition */}
        {recipe && recipe.recipe_ingredients.length > 0 && (
          <div
            className="mt-2 p-3 rounded-lg text-xs space-y-1"
            style={{ backgroundColor: '#F5F2ED', color: '#6B7B6C' }}
          >
            <div className="font-medium" style={{ color: '#2C3E2D' }}>
              Composition ({recipe.recipe_ingredients.length} ingredients) :
            </div>
            {recipe.recipe_ingredients
              .sort((a, b) => b.pourcentage - a.pourcentage)
              .map(ing => {
                const name = ing.varieties?.nom_vernaculaire ?? ing.external_materials?.nom ?? '?'
                return (
                  <div key={ing.id}>
                    {name} — {Math.round(ing.pourcentage * 100)}%
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Section parametres */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
            Date de production <span style={{ color: '#BC6C25' }}>*</span>
          </label>
          <input
            type="date"
            value={state.date_production}
            max={today()}
            onChange={e => {
              const d = new Date(e.target.value)
              d.setMonth(d.getMonth() + 24)
              onChange({ date_production: e.target.value, ddm: d.toISOString().split('T')[0] })
            }}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {state.mode === 'produit' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
              Nombre de sachets/pots <span style={{ color: '#BC6C25' }}>*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={state.nb_unites ?? ''}
              onChange={e => handleNbUnitesChange(e.target.value)}
              placeholder="ex: 50"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            {poidsTotal != null && poidsTotal > 0 && (
              <p className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
                = {poidsTotal >= 1000 ? `${(poidsTotal / 1000).toFixed(1)} kg` : `${Math.round(poidsTotal)} g`} au total
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
            Temps de travail (min)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={state.temps_min ?? ''}
            onChange={e => {
              const n = parseInt(e.target.value, 10)
              onChange({ temps_min: isNaN(n) ? null : n })
            }}
            placeholder="Optionnel"
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
            Commentaire
          </label>
          <textarea
            rows={2}
            maxLength={1000}
            value={state.commentaire}
            onChange={e => onChange({ commentaire: e.target.value })}
            placeholder="Optionnel…"
            style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>
      </div>

      {/* Bouton suivant */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#F9F8F6',
            opacity: canNext ? 1 : 0.4,
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}


