'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties } from '@/hooks/useCachedData'
import type { ZodSchema } from 'zod'
import { todayISO } from '@/lib/utils/date'
import { PARTIE_PLANTE_OPTIONS } from '@/lib/constants/partie-plante'

/** Options d'etat plante entree pour le triage */
interface EtatPlanteEntreeConfig {
  entree: { value: string; label: string }[]
}

interface CombinedTransformationMobileFormProps {
  orgSlug: string
  title: string
  /** Table cible combinee pour le sync */
  tableCible: 'cuttings_combined' | 'sortings_combined'
  schema: ZodSchema
  backCategory: string
  /** Si fourni, affiche le selecteur d'etat plante (entree uniquement) */
  etatPlanteConfig?: EtatPlanteEntreeConfig | null
  /** Pre-remplir poids sortie = poids entree (tronconnage) */
  autoSyncPoidsSortie?: boolean
}

function initialState() {
  return {
    variety_id: '',
    partie_plante: '',
    date: todayISO(),
    poids_entree_g: '',
    poids_sortie_g: '',
    temps_min: '',
    etat_plante: '',
    commentaire: '',
  }
}

export default function CombinedTransformationMobileForm({
  orgSlug,
  title,
  tableCible,
  schema,
  backCategory,
  etatPlanteConfig,
  autoSyncPoidsSortie = false,
}: CombinedTransformationMobileFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [sortieManuallyEdited, setSortieManuallyEdited] = useState(false)

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

  function handlePoidsEntreeChange(value: string) {
    set('poids_entree_g', value)
    if (autoSyncPoidsSortie && !sortieManuallyEdited) {
      set('poids_sortie_g', value)
    }
  }

  function handlePoidsSortieChange(value: string) {
    set('poids_sortie_g', value)
    setSortieManuallyEdited(true)
  }

  // Calcul dechet
  const poidsEntreeNum = parseFloat(form.poids_entree_g) || 0
  const poidsSortieNum = parseFloat(form.poids_sortie_g) || 0
  const dechet = poidsEntreeNum > 0 && poidsSortieNum > 0
    ? Math.round((poidsEntreeNum - poidsSortieNum) * 100) / 100
    : null

  const handleSubmit = async () => {
    setGlobalError(null)

    const payload: Record<string, unknown> = {
      variety_id: form.variety_id,
      partie_plante: form.partie_plante,
      date: form.date,
      poids_entree_g: form.poids_entree_g ? parseFloat(form.poids_entree_g) : undefined,
      poids_sortie_g: form.poids_sortie_g ? parseFloat(form.poids_sortie_g) : undefined,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    if (etatPlanteConfig) {
      payload.etat_plante = form.etat_plante
    }

    const result = schema.safeParse(payload)
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
        table_cible: tableCible,
        farm_id: farmId,
        payload: result.data as Record<string, unknown>,
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
    setSortieManuallyEdited(false)
  }

  const backHref = `/${orgSlug}/m/saisie/${backCategory}`

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
    sublabel: v.nom_latin ?? undefined,
  }))

  return (
    <MobileFormLayout
      title={title}
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
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

      {/* Etat plante entree (triage uniquement) */}
      {etatPlanteConfig && (
        <MobileSelect
          label="État plante"
          required
          value={form.etat_plante}
          onChange={(v) => set('etat_plante', v)}
          options={etatPlanteConfig.entree}
          error={errors.etat_plante}
        />
      )}

      <MobileInput
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(v) => set('date', v)}
        error={errors.date}
      />

      <MobileInput
        label="Poids entrée"
        required
        type="number"
        value={form.poids_entree_g}
        onChange={handlePoidsEntreeChange}
        placeholder="0"
        suffix="g"
        error={errors.poids_entree_g}
      />

      <MobileInput
        label="Poids sortie"
        required
        type="number"
        value={form.poids_sortie_g}
        onChange={handlePoidsSortieChange}
        placeholder="0"
        suffix="g"
        error={errors.poids_sortie_g}
      />

      {/* Ligne dechet (triage) */}
      {!autoSyncPoidsSortie && dechet !== null && dechet >= 0 && (
        <div
          className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: dechet > 0 ? '#FEF3C7' : '#DCFCE7',
            color: dechet > 0 ? '#92400E' : '#166534',
          }}
        >
          Déchet : {dechet} g ({poidsEntreeNum > 0 ? Math.round(dechet / poidsEntreeNum * 100) : 0} %)
        </div>
      )}

      {/* Hint tronconnage */}
      {autoSyncPoidsSortie && !sortieManuallyEdited && form.poids_entree_g && (
        <p className="text-xs px-1" style={{ color: '#9CA89D' }}>
          Poids sortie pré-rempli = poids entrée (modifiable)
        </p>
      )}

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
