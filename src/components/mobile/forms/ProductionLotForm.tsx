'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedRecipes } from '@/hooks/useCachedData'
import { mobileProductionLotSchema } from '@/lib/validation/produits'
import { todayISO } from '@/lib/utils/date'
import DateYearWarning from '@/components/shared/DateYearWarning'
import type { ProductionMode } from '@/lib/types'
import { MODE_LABELS, MODE_DESCRIPTIONS } from '@/components/produits/types'

function initialState() {
  return {
    mode: 'produit' as ProductionMode,
    recipe_id: '',
    nb_unites: '',
    date_production: todayISO(),
    temps_min: '',
    commentaire: '',
  }
}

interface ProductionLotFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile simplifié — Production de lot (production_lots).
 * Pas de modification d'ingrédients — la recette de base est utilisée telle quelle.
 * Le dispatch serveur charge les ingrédients depuis la recette.
 */
export default function ProductionLotForm({ orgSlug }: ProductionLotFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { recipes, isLoading: recipesLoading } = useCachedRecipes()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const set = useCallback(
    <K extends keyof ReturnType<typeof initialState>>(key: K, value: ReturnType<typeof initialState>[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const handleSubmit = async () => {
    setGlobalError(null)

    const payload = {
      mode: form.mode,
      recipe_id: form.recipe_id,
      nb_unites: form.nb_unites ? parseInt(form.nb_unites, 10) : null,
      date_production: form.date_production,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = mobileProductionLotSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString()
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await addEntry({
        table_cible: 'production_lots',
        farm_id: farmId,
        payload: result.data as unknown as Record<string, unknown>,
      })
      setSuccess(true)
    } catch {
      setGlobalError('Erreur lors de l\'enregistrement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm(initialState())
    setErrors({})
    setSuccess(false)
    setGlobalError(null)
  }

  const backHref = `/${orgSlug}/m/saisie/produits`

  // Uniquement les recettes actives
  const recipeOptions = recipes
    .filter((r) => r.actif)
    .map((r) => ({
      value: r.id,
      label: r.nom,
    }))

  return (
    <MobileFormLayout
      title="Production de lot"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      {/* Sélecteur de mode : Produit / Mélange */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(['produit', 'melange'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                set('mode', m)
                if (m === 'melange') set('nb_unites', '')
              }}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                form.mode === m
                  ? 'border-green-600 bg-green-50 text-green-900'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <span className="block text-sm font-semibold">{MODE_LABELS[m]}</span>
              <span className="block text-xs leading-tight opacity-70">{MODE_DESCRIPTIONS[m]}</span>
            </button>
          ))}
        </div>
        {errors.mode && <p className="text-sm text-red-600">{errors.mode}</p>}
      </div>

      <MobileSelect
        label="Recette"
        required
        value={form.recipe_id}
        onChange={(v) => set('recipe_id', v)}
        options={recipeOptions}
        placeholder={recipesLoading ? 'Chargement…' : 'Sélectionner une recette'}
        error={errors.recipe_id}
      />

      {form.mode === 'produit' && (
        <MobileInput
          label="Nombre d'unités (sachets/pots)"
          required
          type="number"
          value={form.nb_unites}
          onChange={(v) => set('nb_unites', v)}
          placeholder="0"
          error={errors.nb_unites}
        />
      )}

      <MobileInput
        label="Date de production"
        required
        type="date"
        value={form.date_production}
        onChange={(v) => set('date_production', v)}
        error={errors.date_production}
      />
      <DateYearWarning date={form.date_production} />

      <MobileTimerInput
        label="Temps"
        value={form.temps_min}
        onChange={(v) => set('temps_min', v)}
        error={errors.temps_min}
      />

      <MobileTextarea
        label="Commentaire"
        value={form.commentaire}
        onChange={(v) => set('commentaire', v)}
        placeholder="Notes, observations…"
      />
    </MobileFormLayout>
  )
}
