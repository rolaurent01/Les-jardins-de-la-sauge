'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileRowSelect from '@/components/mobile/fields/MobileRowSelect'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties, useCachedPlantings } from '@/hooks/useCachedData'
import { harvestSchema } from '@/lib/validation/parcelles'
import { todayISO } from '@/lib/utils/date'
import { PARTIE_PLANTE_OPTIONS } from '@/lib/constants/partie-plante'

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
  const { plantings } = useCachedPlantings()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Index des varietes actives par rang
  const varietiesByRow = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>()
    for (const p of plantings) {
      if (!p.actif) continue
      const list = map.get(p.row_id) ?? []
      if (!list.some(v => v.id === p.variety_id)) {
        list.push({ id: p.variety_id, name: p.variety_name })
      }
      map.set(p.row_id, list)
    }
    return map
  }, [plantings])

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

  // Quand le rang change, auto-remplir la variete
  const handleRowChange = useCallback((rowId: string) => {
    set('row_id', rowId)
    const rowVars = varietiesByRow.get(rowId) ?? []
    if (rowVars.length === 1) {
      set('variety_id', rowVars[0].id)
    } else {
      set('variety_id', '')
    }
    set('partie_plante', '')
  }, [set, varietiesByRow])

  // Varietes du rang selectionne (mode parcelle)
  const isParcelle = form.type_cueillette === 'parcelle'
  const rowVars = isParcelle && form.row_id ? (varietiesByRow.get(form.row_id) ?? []) : []
  const hasRowVarieties = rowVars.length > 0
  const autoVariety = rowVars.length === 1 ? rowVars[0] : null

  // Options de varietes
  const varietyOptions = useMemo(() => {
    if (isParcelle && hasRowVarieties) {
      return rowVars.map(v => ({ value: v.id, label: v.name }))
    }
    return varieties.map((v) => ({
      value: v.id,
      label: v.nom_vernaculaire,
      sublabel: v.nom_latin ?? undefined,
    }))
  }, [isParcelle, hasRowVarieties, rowVars, varieties])

  const handleSubmit = async () => {
    setGlobalError(null)

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
                set('row_id', '')
                set('lieu_sauvage', '')
                set('variety_id', '')
                set('partie_plante', '')
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
          onChange={handleRowChange}
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

      {/* Variete : auto-remplie si 1 seule sur le rang */}
      {isParcelle && autoVariety ? (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#2C3E2D' }}>
            Variété
          </label>
          <div
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: '#F5F2ED', border: '1px solid #E8E3DB', color: '#2C3E2D' }}
          >
            {autoVariety.name}
          </div>
          <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
            Seule variété active sur ce rang
          </p>
        </div>
      ) : (
        <MobileSearchSelect
          label="Variété"
          required
          value={form.variety_id}
          onChange={(v) => {
            set('variety_id', v)
            set('partie_plante', '')
          }}
          options={varietyOptions}
          placeholder={varietiesLoading ? 'Chargement…' : 'Sélectionner une variété'}
          searchPlaceholder="Rechercher une variété..."
          error={errors.variety_id}
        />
      )}

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
