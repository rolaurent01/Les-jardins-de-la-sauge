'use client'

import type { StockLevel } from '@/lib/types'
import type { WizardState, WizardIngredient } from './ProductionWizard'

type Props = {
  state: WizardState
  stockLevels: StockLevel[]
  onChange: (patch: Partial<WizardState>) => void
  onPrev: () => void
  onNext: () => void
}

/** Trouve le stock disponible pour un ingredient plante (3 dimensions) */
function findStock(
  stockLevels: StockLevel[],
  varietyId: string,
  partie: string,
  etat: string,
): number {
  const match = stockLevels.find(
    s => s.variety_id === varietyId && s.partie_plante === partie && s.etat_plante === etat,
  )
  return match?.stock_g ?? 0
}

export default function WizardStepStock({ state, stockLevels, onPrev, onNext }: Props) {
  // Enrichir les ingredients avec le stock disponible
  const enriched: (WizardIngredient & { stockDispo: number | null; manque: number })[] =
    state.ingredients.map(ing => {
      if (!ing.variety_id) {
        return { ...ing, stockDispo: null, manque: 0 }
      }
      const stockDispo = findStock(
        stockLevels,
        ing.variety_id,
        ing.partie_plante ?? '',
        ing.etat_plante ?? '',
      )
      const manque = Math.max(0, ing.poids_g - stockDispo)
      return { ...ing, stockDispo, manque }
    })

  const planteIngredients = enriched.filter(i => i.variety_id != null)
  const insuffisants = planteIngredients.filter(i => i.manque > 0)
  const allOk = insuffisants.length === 0

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
        Verification du stock disponible
      </div>

      {/* Bandeau global */}
      {allOk ? (
        <div
          className="px-4 py-3 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #16653444' }}
        >
          Stock suffisant pour tous les ingredients
        </div>
      ) : (
        <div
          className="px-4 py-3 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B44' }}
        >
          Stock insuffisant pour {insuffisants.length} ingredient{insuffisants.length > 1 ? 's' : ''} — la production sera refusee
        </div>
      )}

      {/* Tableau stock */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Ingredient
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Partie
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Etat
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Requis (g)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Disponible (g)
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((ing, i) => {
              const isPlante = ing.variety_id != null
              const ok = !isPlante || ing.manque === 0

              return (
                <tr
                  key={ing.tempId}
                  style={{
                    backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                    borderBottom: '1px solid #EDE8E0',
                  }}
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: '#2C3E2D' }}>
                    {ing.variety_name || ing.material_name}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: '#2C3E2D' }}>
                    {ing.partie_plante ?? '—'}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: '#2C3E2D' }}>
                    {ing.etat_plante ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ color: '#2C3E2D' }}>
                    {Math.round(ing.poids_g * 10) / 10}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ color: '#2C3E2D' }}>
                    {isPlante ? Math.round((ing.stockDispo ?? 0) * 10) / 10 : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {!isPlante ? (
                      <span style={{ color: '#9CA89D' }}>—</span>
                    ) : ok ? (
                      <span style={{ color: '#166534' }}>OK</span>
                    ) : (
                      <span style={{ color: '#DC2626' }}>
                        -{Math.round(ing.manque * 10) / 10} g
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
        >
          ← Precedent
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!allOk}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#F9F8F6',
            opacity: allOk ? 1 : 0.4,
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
