'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileRowSelect from '@/components/mobile/fields/MobileRowSelect'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties } from '@/hooks/useCachedData'
import { harvestSchema } from '@/lib/validation/parcelles'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const PARTIE_PLANTE_OPTIONS = [
  { value: 'feuille', label: 'Feuille' },
  { value: 'fleur', label: 'Fleur' },
  { value: 'graine', label: 'Graine' },
  { value: 'racine', label: 'Racine' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'plante_entiere', label: 'Plante entière' },
]

type TypeCueillette = 'parcelle' | 'sauvage'

function initialState() {
  return {
    type_cueillette: 'parcelle' as TypeCueillette,
    row_id: '',
    lieu_sauvage: '',
    variety_id: '',
    partie_plante: '',
    date: todayISO(),
    poids_g: '',
    temps_min: '',
    commentaire: '',
  }
}

interface CueilletteFormProps {
  orgSlug: string
}

/** Formulaire mobile — Cueillette (harvests). Adaptatif parcelle / sauvage. */
export default function CueilletteForm({ orgSlug }: CueilletteFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()

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

    const isParcelle = form.type_cueillette === 'parcelle'

    const payload = {
      type_cueillette: form.type_cueillette,
      row_id: isParcelle ? form.row_id : null,
      lieu_sauvage: isParcelle ? null : form.lieu_sauvage || null,
      variety_id: form.variety_id,
      partie_plante: form.partie_plante,
      date: form.date,
      poids_g: form.poids_g ? parseFloat(form.poids_g) : undefined,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = harvestSchema.safeParse(payload)
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
        table_cible: 'harvests',
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

  const backHref = `/${orgSlug}/m/saisie/parcelle`

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
    sublabel: v.nom_latin ?? undefined,
  }))

  const isParcelle = form.type_cueillette === 'parcelle'

  return (
    <MobileFormLayout
      title="Cueillette"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      {/* Toggle parcelle / sauvage */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
          Type de cueillette <span className="text-red-500">*</span>
        </span>
        <div className="flex gap-2">
          {([
            { value: 'parcelle', label: 'Parcelle' },
            { value: 'sauvage', label: 'Sauvage' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                set('type_cueillette', opt.value)
                // Réinitialiser les champs conditionnels
                set('row_id', '')
                set('lieu_sauvage', '')
              }}
              className="flex-1 py-3 text-sm font-medium rounded-xl transition-colors"
              style={{
                backgroundColor: form.type_cueillette === opt.value ? 'var(--color-primary)' : '#fff',
                color: form.type_cueillette === opt.value ? '#fff' : '#2C3E2D',
                border: form.type_cueillette === opt.value ? 'none' : '1px solid #E5E5E5',
                fontSize: 16,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Champs conditionnels */}
      {isParcelle ? (
        <MobileRowSelect
          value={form.row_id}
          onChange={(v) => set('row_id', v)}
          error={errors.row_id}
        />
      ) : (
        <MobileInput
          label="Lieu"
          required
          value={form.lieu_sauvage}
          onChange={(v) => set('lieu_sauvage', v)}
          placeholder="Nom du lieu de cueillette"
          error={errors.lieu_sauvage}
        />
      )}

      <MobileSearchSelect
        label="Variété"
        required
        value={form.variety_id}
        onChange={(v) => set('variety_id', v)}
        options={varietyOptions}
        placeholder={varietiesLoading ? 'Chargement…' : 'Sélectionner une variété'}
        searchPlaceholder="Rechercher une variété..."
        error={errors.variety_id}
      />

      <MobileSelect
        label="Partie plante"
        required
        value={form.partie_plante}
        onChange={(v) => set('partie_plante', v)}
        options={PARTIE_PLANTE_OPTIONS}
        error={errors.partie_plante}
      />

      <MobileInput
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(v) => set('date', v)}
        error={errors.date}
      />

      <MobileInput
        label="Poids"
        required
        type="number"
        value={form.poids_g}
        onChange={(v) => set('poids_g', v)}
        placeholder="0"
        suffix="g"
        error={errors.poids_g}
      />

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
