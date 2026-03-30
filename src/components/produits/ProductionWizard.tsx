'use client'

import { useState, useEffect } from 'react'
import type { ProductionMode, ProductCategory, StockLevel } from '@/lib/types'
import type { RecipeForSelect } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import WizardStepRecipe from './WizardStepRecipe'
import WizardStepIngredients from './WizardStepIngredients'
import WizardStepStock from './WizardStepStock'
import WizardStepConfirm from './WizardStepConfirm'

/** Ingredient dans le wizard avec donnees d'affichage */
export type WizardIngredient = {
  tempId: string
  variety_id: string | null
  external_material_id: string | null
  variety_name: string
  material_name: string
  partie_plante: string | null
  etat_plante: string | null
  pourcentage: number
  poids_g: number
  annee_recolte: number | null
  fournisseur: string | null
  stock_disponible_g: number | null
}

/** State global du wizard */
export type WizardState = {
  step: 1 | 2 | 3 | 4
  mode: ProductionMode
  recipe_id: string
  recipe: RecipeForSelect | null
  date_production: string
  nb_unites: number | null
  poids_total_g: number | null
  temps_min: number | null
  commentaire: string
  ddm: string
  ingredients: WizardIngredient[]
}

const STEP_LABELS = ['Recette', 'Composition', 'Stock', 'Confirmation']

type Props = {
  recipes: RecipeForSelect[]
  categories: ProductCategory[]
  stockLevels: StockLevel[]
  onClose: () => void
  onSuccess: () => void
}

function defaultDdm(dateProduction: string): string {
  const d = new Date(dateProduction)
  d.setMonth(d.getMonth() + 24)
  return d.toISOString().split('T')[0]
}

function initialState(): WizardState {
  const date_production = new Date().toISOString().split('T')[0]
  return {
    step: 1,
    mode: 'produit',
    recipe_id: '',
    recipe: null,
    date_production,
    nb_unites: null,
    poids_total_g: null,
    temps_min: null,
    commentaire: '',
    ddm: defaultDdm(date_production),
    ingredients: [],
  }
}

export default function ProductionWizard({ recipes, categories, stockLevels, onClose, onSuccess }: Props) {
  const [state, setState] = useState<WizardState>(initialState)

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function updateState(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }))
  }

  function goTo(step: 1 | 2 | 3 | 4) {
    setState(prev => ({ ...prev, step }))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: '#FAF5E9',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Barre superieure */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #D8E0D9' }}
      >
        <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
          Produire un lot
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: '#9CA89D' }}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* Barre de progression */}
      <div className="px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #EDE8E0' }}>
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          {STEP_LABELS.map((label, idx) => {
            const stepNum = (idx + 1) as 1 | 2 | 3 | 4
            const isCurrent = state.step === stepNum
            const isDone = state.step > stepNum

            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: isCurrent
                        ? 'var(--color-primary)'
                        : isDone
                          ? '#DCFCE7'
                          : '#F3F4F6',
                      color: isCurrent ? '#F9F8F6' : isDone ? '#166534' : '#9CA89D',
                    }}
                  >
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:inline"
                    style={{ color: isCurrent ? '#2C3E2D' : '#9CA89D' }}
                  >
                    {label}
                  </span>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: isDone ? '#16653444' : '#D8E0D9' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Contenu du step */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {state.step === 1 && (
            <WizardStepRecipe
              state={state}
              recipes={recipes}
              categories={categories}
              onChange={updateState}
              onNext={() => goTo(2)}
            />
          )}
          {state.step === 2 && (
            <WizardStepIngredients
              state={state}
              onChange={updateState}
              onPrev={() => goTo(1)}
              onNext={() => goTo(3)}
            />
          )}
          {state.step === 3 && (
            <WizardStepStock
              state={state}
              stockLevels={stockLevels}
              onChange={updateState}
              onPrev={() => goTo(2)}
              onNext={() => goTo(4)}
            />
          )}
          {state.step === 4 && (
            <WizardStepConfirm
              state={state}
              categories={categories}
              onPrev={() => goTo(3)}
              onSuccess={onSuccess}
              onChange={updateState}
            />
          )}
        </div>
      </div>
    </div>
  )
}
