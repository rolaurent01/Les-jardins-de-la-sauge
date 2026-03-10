'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedRecipes } from '@/hooks/useCachedData'
import { mobileProductionLotSchema } from '@/lib/validation/produits'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function initialState() {
  return {
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
      recipe_id: form.recipe_id,
      nb_unites: form.nb_unites ? parseInt(form.nb_unites, 10) : undefined,
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
        payload: {
          ...(result.data as unknown as Record<string, unknown>),
          mode: 'produit',
        },
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
      <MobileSelect
        label="Recette"
        required
        value={form.recipe_id}
        onChange={(v) => set('recipe_id', v)}
        options={recipeOptions}
        placeholder={recipesLoading ? 'Chargement…' : 'Sélectionner une recette'}
        error={errors.recipe_id}
      />

      <MobileInput
        label="Nombre d'unités (sachets/pots)"
        required
        type="number"
        value={form.nb_unites}
        onChange={(v) => set('nb_unites', v)}
        placeholder="0"
        error={errors.nb_unites}
      />

      <MobileInput
        label="Date de production"
        required
        type="date"
        value={form.date_production}
        onChange={(v) => set('date_production', v)}
        error={errors.date_production}
      />

      <MobileInput
        label="Temps"
        type="number"
        value={form.temps_min}
        onChange={(v) => set('temps_min', v)}
        placeholder="0"
        suffix="min"
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
