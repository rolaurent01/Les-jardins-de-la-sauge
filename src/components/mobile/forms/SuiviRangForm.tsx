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
import { rowCareSchema } from '@/lib/validation/parcelles'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const TYPE_SOIN_OPTIONS = [
  { value: 'desherbage', label: 'Désherbage' },
  { value: 'paillage', label: 'Paillage' },
  { value: 'arrosage', label: 'Arrosage' },
  { value: 'autre', label: 'Autre' },
]

function initialState() {
  return {
    row_id: '',
    variety_id: '',
    date: todayISO(),
    type_soin: '',
    temps_min: '',
    commentaire: '',
  }
}

interface SuiviRangFormProps {
  orgSlug: string
}

/** Formulaire mobile — Suivi de rang (row_care) */
export default function SuiviRangForm({ orgSlug }: SuiviRangFormProps) {
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

    const payload = {
      row_id: form.row_id,
      variety_id: form.variety_id,
      date: form.date,
      type_soin: form.type_soin,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = rowCareSchema.safeParse(payload)
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
        table_cible: 'row_care',
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

  return (
    <MobileFormLayout
      title="Suivi de rang"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      <MobileRowSelect
        value={form.row_id}
        onChange={(v) => set('row_id', v)}
        error={errors.row_id}
      />

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

      <MobileInput
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(v) => set('date', v)}
        error={errors.date}
      />

      <MobileSelect
        label="Type de soin"
        required
        value={form.type_soin}
        onChange={(v) => set('type_soin', v)}
        options={TYPE_SOIN_OPTIONS}
        error={errors.type_soin}
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
