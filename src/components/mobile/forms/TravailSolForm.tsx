'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileRowSelect from '@/components/mobile/fields/MobileRowSelect'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { soilWorkSchema } from '@/lib/validation/parcelles'
import { todayISO } from '@/lib/utils/date'
import DateYearWarning from '@/components/shared/DateYearWarning'

const TYPE_TRAVAIL_OPTIONS = [
  { value: 'depaillage', label: 'Dépaillage' },
  { value: 'motoculteur', label: 'Motoculteur' },
  { value: 'amendement', label: 'Amendement' },
  { value: 'autre', label: 'Autre' },
]

function initialState() {
  return {
    row_id: '',
    date: todayISO(),
    type_travail: '',
    detail: '',
    temps_min: '',
    commentaire: '',
  }
}

interface TravailSolFormProps {
  orgSlug: string
}

/** Formulaire mobile — Travail de sol (soil_works) */
export default function TravailSolForm({ orgSlug }: TravailSolFormProps) {
  const { addEntry, farmId } = useMobileSync()

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
      date: form.date,
      type_travail: form.type_travail,
      detail: form.detail || null,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = soilWorkSchema.safeParse(payload)
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
        table_cible: 'soil_works',
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

  return (
    <MobileFormLayout
      title="Travail de sol"
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

      <MobileInput
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(v) => set('date', v)}
        error={errors.date}
      />
      <DateYearWarning date={form.date} />

      <MobileSelect
        label="Type de travail"
        required
        value={form.type_travail}
        onChange={(v) => set('type_travail', v)}
        options={TYPE_TRAVAIL_OPTIONS}
        error={errors.type_travail}
      />

      <MobileInput
        label="Détail"
        value={form.detail}
        onChange={(v) => set('detail', v)}
        placeholder="Précisions sur le type"
        error={errors.detail}
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
