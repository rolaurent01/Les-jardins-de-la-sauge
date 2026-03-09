'use client'

import { useTransition, useState } from 'react'
import { formatDate } from '@/lib/utils/format'
import { generateProductionLotNumber, getRecipeCode } from '@/lib/utils/lots'
import { createProductionLot } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import { MODE_LABELS } from './types'
import type { WizardState } from './ProductionWizard'
import type { ProductCategory } from '@/lib/types'

type Props = {
  state: WizardState
  categories: ProductCategory[]
  onPrev: () => void
  onSuccess: () => void
}

export default function WizardStepConfirm({ state, categories, onPrev, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successLot, setSuccessLot] = useState<string | null>(null)

  // Preview du numero de lot
  const recipeName = state.recipe?.nom ?? ''
  const code = getRecipeCode(recipeName)
  const dateProd = new Date(state.date_production)
  const numeroLotPreview = generateProductionLotNumber(code, dateProd)

  // DDM preview
  const ddmDate = new Date(dateProd)
  ddmDate.setMonth(ddmDate.getMonth() + 24)
  const ddmStr = ddmDate.toISOString().split('T')[0]

  // Categorie
  const category = categories.find(c => c.id === state.recipe?.category_id)

  // Poids total
  const poidsTotal = state.poids_total_g ?? state.ingredients.reduce((s, i) => s + i.poids_g, 0)

  function handleConfirm() {
    setError(null)

    const fd = new FormData()
    fd.set('recipe_id', state.recipe_id)
    fd.set('mode', state.mode)
    fd.set('date_production', state.date_production)
    if (state.nb_unites != null) fd.set('nb_unites', String(state.nb_unites))
    if (state.poids_total_g != null) fd.set('poids_total_g', String(state.poids_total_g))
    if (state.temps_min != null) fd.set('temps_min', String(state.temps_min))
    if (state.commentaire) fd.set('commentaire', state.commentaire)

    const ingredientsPayload = state.ingredients.map(ing => ({
      variety_id: ing.variety_id,
      external_material_id: ing.external_material_id,
      etat_plante: ing.etat_plante,
      partie_plante: ing.partie_plante,
      pourcentage: ing.pourcentage,
      poids_g: ing.poids_g,
      annee_recolte: ing.annee_recolte,
      fournisseur: ing.fournisseur,
    }))
    fd.set('ingredients', JSON.stringify(ingredientsPayload))

    startTransition(async () => {
      const result = await createProductionLot(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccessLot(result.data?.numero_lot ?? numeroLotPreview)
      }
    })
  }

  // Ecran de succes
  if (successLot) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-4xl">✅</div>
        <h3 className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          Lot {successLot} cree avec succes
        </h3>
        <button
          onClick={onSuccess}
          className="px-5 py-2.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
        >
          Retour a la liste
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
        Recapitulatif — verifiez avant de confirmer
      </div>

      {/* Resume */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{ backgroundColor: '#F5F2ED', border: '1px solid #D8E0D9' }}
      >
        <Row label="Recette" value={`${recipeName}${category ? ` (${category.nom})` : ''}`} />
        <Row label="Mode" value={MODE_LABELS[state.mode]} />
        <Row label="N° lot (preview)" value={numeroLotPreview} mono />
        <Row label="Date production" value={formatDate(state.date_production)} />
        <Row label="DDM" value={formatDate(ddmStr)} />
        <Row
          label="Unites"
          value={state.nb_unites != null ? String(state.nb_unites) : 'A conditionner'}
        />
        <Row
          label="Poids total"
          value={poidsTotal >= 1000 ? `${(poidsTotal / 1000).toFixed(1)} kg` : `${Math.round(poidsTotal)} g`}
        />
        {state.temps_min != null && (
          <Row label="Temps" value={`${state.temps_min} min`} />
        )}
        {state.commentaire && (
          <Row label="Commentaire" value={state.commentaire} />
        )}
      </div>

      {/* Tableau ingredients */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Ingredient
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                %
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                Poids (g)
              </th>
            </tr>
          </thead>
          <tbody>
            {state.ingredients.map((ing, i) => (
              <tr
                key={ing.tempId}
                style={{
                  backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                  borderBottom: '1px solid #EDE8E0',
                }}
              >
                <td className="px-3 py-2 font-medium" style={{ color: '#2C3E2D' }}>
                  {ing.variety_name || ing.material_name}
                </td>
                <td className="px-3 py-2 text-right" style={{ color: '#6B7B6C' }}>
                  {Math.round(ing.pourcentage * 1000) / 10}%
                </td>
                <td className="px-3 py-2 text-right" style={{ color: '#2C3E2D' }}>
                  {Math.round(ing.poids_g * 10) / 10}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Erreur */}
      {error && (
        <div
          className="text-sm px-3 py-2.5 rounded-lg"
          style={{
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            border: '1px solid #991B1B44',
          }}
        >
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
        >
          ← Precedent
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#F9F8F6',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Creation en cours…' : 'Confirmer la production'}
        </button>
      </div>
    </div>
  )
}

/* ---- Sous-composant ligne recap ---- */

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#6B7B6C' }}>{label}</span>
      <span
        className={mono ? 'font-mono' : ''}
        style={{ color: '#2C3E2D', fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
  )
}
