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

/** Date du jour au format YYYY-MM-DD */
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

type TypeEntreeSortie = 'entree' | 'sortie'

/** Options d'état plante par type (entrée/sortie) */
interface EtatPlanteConfig {
  entree: { value: string; label: string }[]
  sortie: { value: string; label: string }[]
}

interface TransformationMobileFormProps {
  orgSlug: string
  /** Titre affiché dans le header */
  title: string
  /** Table cible pour le sync (cuttings, dryings, sortings) */
  tableCible: 'cuttings' | 'dryings' | 'sortings'
  /** Schéma Zod pour validation */
  schema: ZodSchema
  /** Catégorie parente dans l'URL */
  backCategory: string
  /**
   * Si null, l'état plante est implicite (pas de sélecteur).
   * Sinon, affiche un sélecteur conditionnel au type.
   */
  etatPlanteConfig: EtatPlanteConfig | null
  /**
   * Fonction qui retourne l'état plante implicite selon le type.
   * Utilisé quand etatPlanteConfig est null (tronçonnage).
   */
  getImplicitEtatPlante?: (type: TypeEntreeSortie) => string
}

function initialState() {
  return {
    type: 'entree' as TypeEntreeSortie,
    variety_id: '',
    partie_plante: '',
    date: todayISO(),
    poids_g: '',
    temps_min: '',
    etat_plante: '',
    commentaire: '',
  }
}

/**
 * Formulaire mobile partagé pour les 3 modules Transformation.
 * Paramétré par config (table, schéma, états plante).
 */
export default function TransformationMobileForm({
  orgSlug,
  title,
  tableCible,
  schema,
  backCategory,
  etatPlanteConfig,
  getImplicitEtatPlante,
}: TransformationMobileFormProps) {
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

  /** Options d'état plante pour le type sélectionné */
  const etatOptions = useMemo(() => {
    if (!etatPlanteConfig) return []
    return etatPlanteConfig[form.type]
  }, [etatPlanteConfig, form.type])

  const handleSubmit = async () => {
    setGlobalError(null)

    // Construire le payload
    const basePayload = {
      variety_id: form.variety_id,
      partie_plante: form.partie_plante,
      type: form.type,
      date: form.date,
      poids_g: form.poids_g ? parseFloat(form.poids_g) : undefined,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    // État plante : explicite (sélecteur) ou implicite (déduit du type)
    const payload = etatPlanteConfig
      ? { ...basePayload, etat_plante: form.etat_plante }
      : { ...basePayload }

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

    // Pour tronçonnage : injecter l'état plante implicite dans le payload envoyé au sync
    const syncPayload = getImplicitEtatPlante
      ? { ...(result.data as Record<string, unknown>), etat_plante: getImplicitEtatPlante(form.type) }
      : (result.data as unknown as Record<string, unknown>)

    setIsSubmitting(true)
    try {
      await addEntry({
        table_cible: tableCible,
        farm_id: farmId,
        payload: syncPayload,
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
      {/* Toggle Entrée / Sortie */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
          Type <span className="text-red-500">*</span>
        </span>
        <div className="flex gap-2">
          {([
            { value: 'entree', label: 'Entrée' },
            { value: 'sortie', label: 'Sortie' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                set('type', opt.value)
                // Réinitialiser l'état plante quand le type change
                set('etat_plante', '')
              }}
              className="flex-1 py-3 text-sm font-medium rounded-xl transition-colors"
              style={{
                backgroundColor: form.type === opt.value ? 'var(--color-primary)' : '#fff',
                color: form.type === opt.value ? '#fff' : '#2C3E2D',
                border: form.type === opt.value ? 'none' : '1px solid #E5E5E5',
                fontSize: 16,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* État plante (conditionnel — séchage et triage uniquement) */}
      {etatPlanteConfig && (
        <MobileSelect
          label="État plante"
          required
          value={form.etat_plante}
          onChange={(v) => set('etat_plante', v)}
          options={etatOptions}
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
