'use client'

import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'
import type { WizardState, WizardIngredient } from './ProductionWizard'

/** Etats plante utilisables en production */
const ETATS_PRODUCTION: string[] = [
  'frais',
  'sechee',
  'tronconnee_sechee',
  'sechee_triee',
  'tronconnee_sechee_triee',
]

const ETAT_LABELS: Record<string, string> = {
  frais: 'Frais',
  sechee: 'Sechee',
  tronconnee_sechee: 'Tronc. sechee',
  sechee_triee: 'Sechee triee',
  tronconnee_sechee_triee: 'Tronc. sechee triee',
}

type Props = {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onPrev: () => void
  onNext: () => void
}

export default function WizardStepIngredients({ state, onChange, onPrev, onNext }: Props) {
  const isModeProduit = state.mode === 'produit'

  function updateIngredient(tempId: string, patch: Partial<WizardIngredient>) {
    const updated = state.ingredients.map(ing => {
      if (ing.tempId !== tempId) return ing
      return { ...ing, ...patch }
    })

    // En mode melange : recalculer les pourcentages et le poids total
    if (!isModeProduit) {
      const totalPoids = updated.reduce((s, i) => s + (i.poids_g || 0), 0)
      const withPct = updated.map(ing => ({
        ...ing,
        pourcentage: totalPoids > 0 ? ing.poids_g / totalPoids : 0,
      }))
      onChange({ ingredients: withPct, poids_total_g: totalPoids > 0 ? totalPoids : null })
      return
    }

    // En mode produit : recalculer les poids depuis les pourcentages
    if (isModeProduit && state.poids_total_g) {
      const withPoids = updated.map(ing => ({
        ...ing,
        poids_g: Math.round(state.poids_total_g! * ing.pourcentage * 100) / 100,
      }))
      onChange({ ingredients: withPoids })
      return
    }

    onChange({ ingredients: updated })
  }

  function handlePourcentageChange(tempId: string, displayValue: string) {
    const num = parseFloat(displayValue)
    if (isNaN(num)) {
      updateIngredient(tempId, { pourcentage: 0 })
    } else {
      updateIngredient(tempId, { pourcentage: Math.round(num * 10) / 1000 })
    }
  }

  function handlePoidsChange(tempId: string, displayValue: string) {
    const num = parseFloat(displayValue)
    updateIngredient(tempId, { poids_g: isNaN(num) ? 0 : num })
  }

  function removeIngredient(tempId: string) {
    onChange({ ingredients: state.ingredients.filter(i => i.tempId !== tempId) })
  }

  function addIngredient() {
    onChange({
      ingredients: [
        ...state.ingredients,
        {
          tempId: crypto.randomUUID(),
          variety_id: null,
          external_material_id: null,
          variety_name: '',
          material_name: '',
          partie_plante: null,
          etat_plante: null,
          pourcentage: 0,
          poids_g: 0,
          annee_recolte: null,
          fournisseur: null,
          stock_disponible_g: null,
        },
      ],
    })
  }

  // Somme des pourcentages (mode produit)
  const totalPct = state.ingredients.reduce((s, i) => s + i.pourcentage, 0)
  const totalPctDisplay = Math.round(totalPct * 1000) / 10
  const totalIsOk = Math.abs(totalPct - 1.0) <= 0.005

  // Somme des poids (mode melange)
  const totalPoids = state.ingredients.reduce((s, i) => s + (i.poids_g || 0), 0)

  // Validation
  const hasIngredients = state.ingredients.length > 0
  const allHaveState = state.ingredients.every(
    i => i.variety_id == null || (i.etat_plante != null && i.etat_plante !== ''),
  )
  const allExternalHaveFournisseur = state.ingredients.every(
    i => i.external_material_id == null || (i.fournisseur != null && i.fournisseur !== ''),
  )
  const canNext = hasIngredients && allHaveState && allExternalHaveFournisseur &&
    (isModeProduit ? totalIsOk : totalPoids > 0)

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
        {isModeProduit
          ? 'Ajustez les pourcentages — les poids se calculent automatiquement'
          : 'Saisissez les poids reels — les pourcentages se calculent automatiquement'}
      </div>

      {/* Tableau d'ingredients */}
      <div className="space-y-3">
        {state.ingredients.map((ing, idx) => (
          <div
            key={ing.tempId}
            className="p-3 rounded-lg border space-y-2"
            style={{ borderColor: '#D8E0D9', backgroundColor: '#F9F8F6' }}
          >
            {/* Ligne 1 : nom + supprimer */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium flex-shrink-0" style={{ color: '#9CA89D', width: '20px' }}>
                {idx + 1}.
              </span>
              <div className="flex-1 font-medium text-sm" style={{ color: '#2C3E2D' }}>
                {ing.variety_name || ing.material_name || '(ingredient vide)'}
                {ing.variety_id && (
                  <span className="ml-1.5 text-xs font-normal" style={{ color: '#6B7B6C' }}>
                    Plante
                  </span>
                )}
                {ing.external_material_id && (
                  <span className="ml-1.5 text-xs font-normal" style={{ color: '#6B7B6C' }}>
                    Materiau
                  </span>
                )}
              </div>
              {state.ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(ing.tempId)}
                  className="p-1 rounded transition-colors flex-shrink-0"
                  style={{ color: '#9CA89D' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                  title="Supprimer"
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Ligne 2 : etat + partie + pourcentage + poids + annee + fournisseur */}
            <div className="flex items-center gap-2 pl-[28px] flex-wrap">
              {/* Partie plante (visible si plante) */}
              {ing.variety_id && (
                <div style={{ flex: '1', minWidth: '100px' }}>
                  <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>Partie</label>
                  <select
                    value={ing.partie_plante ?? ''}
                    onChange={e => updateIngredient(ing.tempId, { partie_plante: e.target.value || null })}
                    style={inputStyleSm}
                  >
                    <option value="">—</option>
                    {PARTIES_PLANTE.map(p => (
                      <option key={p} value={p}>{PARTIE_PLANTE_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Etat plante */}
              {ing.variety_id && (
                <div style={{ flex: '1', minWidth: '120px' }}>
                  <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>Etat *</label>
                  <select
                    value={ing.etat_plante ?? ''}
                    onChange={e => updateIngredient(ing.tempId, { etat_plante: e.target.value || null })}
                    style={inputStyleSm}
                  >
                    <option value="">— Etat</option>
                    {ETATS_PRODUCTION.map(et => (
                      <option key={et} value={et}>{ETAT_LABELS[et] ?? et}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pourcentage */}
              <div style={{ width: '75px', flexShrink: 0 }}>
                <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>%</label>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={ing.pourcentage > 0 ? Math.round(ing.pourcentage * 1000) / 10 : ''}
                    onChange={e => handlePourcentageChange(ing.tempId, e.target.value)}
                    disabled={!isModeProduit}
                    placeholder="%"
                    style={{ ...inputStyleSm, textAlign: 'right', opacity: isModeProduit ? 1 : 0.7 }}
                  />
                  <span className="text-xs" style={{ color: '#9CA89D' }}>%</span>
                </div>
              </div>

              {/* Poids (g) */}
              <div style={{ width: '80px', flexShrink: 0 }}>
                <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>Poids (g)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={ing.poids_g > 0 ? ing.poids_g : ''}
                  onChange={e => handlePoidsChange(ing.tempId, e.target.value)}
                  disabled={isModeProduit}
                  placeholder="g"
                  style={{ ...inputStyleSm, textAlign: 'right', opacity: isModeProduit ? 0.7 : 1 }}
                />
              </div>

              {/* Annee recolte */}
              <div style={{ width: '70px', flexShrink: 0 }}>
                <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>Annee</label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  step="1"
                  value={ing.annee_recolte ?? ''}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10)
                    updateIngredient(ing.tempId, { annee_recolte: isNaN(n) ? null : n })
                  }}
                  placeholder={String(new Date().getFullYear())}
                  style={inputStyleSm}
                />
              </div>

              {/* Fournisseur */}
              <div style={{ flex: '1', minWidth: '100px' }}>
                <label className="block text-xs mb-0.5" style={{ color: '#9CA89D' }}>
                  Fournisseur{ing.external_material_id ? ' *' : ''}
                </label>
                <input
                  type="text"
                  value={ing.fournisseur ?? ''}
                  onChange={e => updateIngredient(ing.tempId, { fournisseur: e.target.value || null })}
                  placeholder={ing.external_material_id ? 'Obligatoire' : 'Optionnel'}
                  style={inputStyleSm}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bouton ajouter */}
      <button
        type="button"
        onClick={addIngredient}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
      >
        <span className="text-sm leading-none">+</span>
        Ajouter un ingredient
      </button>

      {/* Barre recapitulative */}
      {isModeProduit ? (
        <div
          className="px-3 py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: totalIsOk ? '#DCFCE7' : totalPct > 1 ? '#FEE2E2' : '#FEF3C7',
            color: totalIsOk ? '#166534' : totalPct > 1 ? '#991B1B' : '#92400E',
            border: `1px solid ${totalIsOk ? '#16653444' : totalPct > 1 ? '#991B1B44' : '#F59E0B44'}`,
          }}
        >
          Total : {totalPctDisplay}%
          {!totalIsOk && (
            <span className="ml-2 font-normal text-xs">(doit etre 100%)</span>
          )}
        </div>
      ) : (
        <div
          className="px-3 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#F5F2ED', color: '#2C3E2D', border: '1px solid #D8E0D9' }}
        >
          Total : {totalPoids > 0 ? (totalPoids >= 1000 ? `${(totalPoids / 1000).toFixed(1)} kg` : `${Math.round(totalPoids)} g`) : '— g'}
        </div>
      )}

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

/* ---- Helpers de style ---- */

const inputStyleSm: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #D8E0D9',
  backgroundColor: '#FAF5E9',
  color: '#2C3E2D',
  outline: 'none',
}
