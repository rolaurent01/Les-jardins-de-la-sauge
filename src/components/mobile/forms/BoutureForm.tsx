'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import MobileCheckbox from '@/components/mobile/fields/MobileCheckbox'
import { useCachedVarieties } from '@/hooks/useCachedData'
import { cuttingSchema } from '@/lib/validation/boutures'
import { TYPE_MULTIPLICATION_LABELS } from '@/lib/types'
import type { TypeMultiplication } from '@/lib/types'
import { todayISO } from '@/lib/utils/date'
import DateYearWarning from '@/components/shared/DateYearWarning'

const ALL_TYPES: { value: TypeMultiplication; label: string }[] = [
  { value: 'rhizome',       label: 'Rhizome' },
  { value: 'bouture',       label: 'Bouture' },
  { value: 'marcotte',      label: 'Marcotte' },
  { value: 'eclat_pied',    label: 'Éclat de pied' },
  { value: 'drageon',       label: 'Drageon' },
  { value: 'eclat_racine',  label: 'Éclat de racine' },
]

/** État initial du formulaire */
function initialState() {
  return {
    variety_id: '',
    type_multiplication: 'bouture' as TypeMultiplication,
    origine: '',
    certif_ab: false,
    date_bouturage: todayISO(),
    temps_bouturage_min: '',
    // Plaque
    use_plaque: false,
    nb_plaques: '',
    nb_trous_par_plaque: '',
    nb_mortes_plaque: '',
    date_mise_en_plaque: '',
    // Godet
    nb_godets: '',
    nb_mortes_godet: '',
    date_rempotage: '',
    temps_rempotage_min: '',
    // Résultat
    nb_plants_obtenus: '',
    nb_donnees: '',
    commentaire: '',
  }
}

interface BoutureFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Bouture (boutures).
 * Validation Zod partagée avec le bureau.
 */
export default function BoutureForm({ orgSlug }: BoutureFormProps) {
  const { addEntry, farmId, certifBio } = useMobileSync()
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()

  const [form, setForm] = useState(() => ({ ...initialState(), certif_ab: certifBio }))
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
      variety_id: form.variety_id,
      type_multiplication: form.type_multiplication,
      origine: form.origine || null,
      certif_ab: form.certif_ab,
      date_bouturage: form.date_bouturage,
      temps_bouturage_min: form.temps_bouturage_min ? parseInt(form.temps_bouturage_min, 10) : null,
      // Plaque
      nb_plaques: form.use_plaque && form.nb_plaques ? parseInt(form.nb_plaques, 10) : null,
      nb_trous_par_plaque: form.use_plaque && form.nb_trous_par_plaque ? parseInt(form.nb_trous_par_plaque, 10) : null,
      nb_mortes_plaque: form.use_plaque && form.nb_mortes_plaque ? parseInt(form.nb_mortes_plaque, 10) : 0,
      date_mise_en_plaque: form.use_plaque && form.date_mise_en_plaque ? form.date_mise_en_plaque : null,
      // Godet
      nb_godets: form.nb_godets ? parseInt(form.nb_godets, 10) : null,
      nb_mortes_godet: form.nb_mortes_godet ? parseInt(form.nb_mortes_godet, 10) : 0,
      date_rempotage: form.date_rempotage || null,
      temps_rempotage_min: form.temps_rempotage_min ? parseInt(form.temps_rempotage_min, 10) : null,
      // Résultat
      nb_plants_obtenus: form.nb_plants_obtenus ? parseInt(form.nb_plants_obtenus, 10) : null,
      nb_donnees: form.nb_donnees ? parseInt(form.nb_donnees, 10) : 0,
      commentaire: form.commentaire || null,
    }

    const result = cuttingSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString()
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await addEntry({
        table_cible: 'boutures',
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
    setForm({ ...initialState(), certif_ab: certifBio })
    setErrors({})
    setSuccess(false)
    setGlobalError(null)
  }

  const backHref = `/${orgSlug}/m/saisie/semis`

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
    sublabel: v.nom_latin ?? undefined,
  }))

  const typeOptions = ALL_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
  }))

  return (
    <MobileFormLayout
      title="Bouture"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      {/* Type de multiplication */}
      <MobileSearchSelect
        label="Type de multiplication"
        required
        value={form.type_multiplication}
        onChange={(v) => set('type_multiplication', v as TypeMultiplication)}
        options={typeOptions}
        placeholder="Sélectionner le type"
        error={errors.type_multiplication}
      />

      {/* Variété */}
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

      {varieties.length === 0 && !varietiesLoading && (
        <p className="text-xs" style={{ color: '#999', marginTop: -8 }}>
          Variété manquante ? Notez le nom en commentaire et ajoutez-la au retour en Wi-Fi.
        </p>
      )}

      {/* Origine */}
      <MobileInput
        label="Origine"
        value={form.origine}
        onChange={(v) => set('origine', v)}
        placeholder="ex : Jardin La Sauge, Collègue X"
        error={errors.origine}
      />

      {/* Certif AB */}
      <MobileCheckbox
        label="Certifié AB"
        checked={form.certif_ab}
        onChange={(v) => set('certif_ab', v)}
      />

      {/* Date bouturage */}
      <MobileInput
        label="Date de bouturage"
        required
        type="date"
        value={form.date_bouturage}
        onChange={(v) => set('date_bouturage', v)}
        error={errors.date_bouturage}
      />
      <DateYearWarning date={form.date_bouturage} />

      {/* Temps bouturage */}
      <MobileInput
        label="Temps bouturage (min)"
        type="number"
        value={form.temps_bouturage_min}
        onChange={(v) => set('temps_bouturage_min', v)}
        placeholder="ex : 45"
        error={errors.temps_bouturage_min}
      />

      {/* Toggle plaque */}
      <MobileCheckbox
        label="Utilisation de plaque alvéolée"
        checked={form.use_plaque}
        onChange={(v) => set('use_plaque', v)}
      />

      {/* Champs plaque */}
      {form.use_plaque && (
        <>
          <MobileInput
            label="Nombre de plaques"
            required
            type="number"
            value={form.nb_plaques}
            onChange={(v) => set('nb_plaques', v)}
            placeholder="ex : 2"
            error={errors.nb_plaques}
          />
          <MobileInput
            label="Trous par plaque"
            required
            type="number"
            value={form.nb_trous_par_plaque}
            onChange={(v) => set('nb_trous_par_plaque', v)}
            placeholder="ex : 77"
            error={errors.nb_trous_par_plaque}
          />
          {form.nb_plaques && form.nb_trous_par_plaque && (
            <p className="text-xs" style={{ color: '#6B7B6C', marginTop: -8 }}>
              Total : {parseInt(form.nb_plaques, 10) * parseInt(form.nb_trous_par_plaque, 10)} boutures
            </p>
          )}
          <MobileInput
            label="Mortes en plaque"
            type="number"
            value={form.nb_mortes_plaque}
            onChange={(v) => set('nb_mortes_plaque', v)}
            error={errors.nb_mortes_plaque}
          />
          <MobileInput
            label="Date mise en plaque"
            type="date"
            value={form.date_mise_en_plaque}
            onChange={(v) => set('date_mise_en_plaque', v)}
            error={errors.date_mise_en_plaque}
          />
        </>
      )}

      {/* Godet */}
      <MobileInput
        label="Nombre de godets"
        type="number"
        value={form.nb_godets}
        onChange={(v) => set('nb_godets', v)}
        placeholder="ex : 45"
        error={errors.nb_godets}
      />
      <MobileInput
        label="Mortes en godet"
        type="number"
        value={form.nb_mortes_godet}
        onChange={(v) => set('nb_mortes_godet', v)}
        error={errors.nb_mortes_godet}
      />

      {form.use_plaque && (
        <>
          <MobileInput
            label="Date de rempotage"
            type="date"
            value={form.date_rempotage}
            onChange={(v) => set('date_rempotage', v)}
            error={errors.date_rempotage}
          />
          <MobileInput
            label="Temps rempotage (min)"
            type="number"
            value={form.temps_rempotage_min}
            onChange={(v) => set('temps_rempotage_min', v)}
            error={errors.temps_rempotage_min}
          />
        </>
      )}

      {/* Résultat */}
      <MobileInput
        label="Plants obtenus"
        type="number"
        value={form.nb_plants_obtenus}
        onChange={(v) => set('nb_plants_obtenus', v)}
        placeholder="ex : 30"
        error={errors.nb_plants_obtenus}
      />
      <MobileInput
        label="Plants donnés"
        type="number"
        value={form.nb_donnees}
        onChange={(v) => set('nb_donnees', v)}
        error={errors.nb_donnees}
      />

      {/* Commentaire */}
      <MobileTextarea
        label="Commentaire"
        value={form.commentaire}
        onChange={(v) => set('commentaire', v)}
        placeholder="Observations, conditions…"
      />
    </MobileFormLayout>
  )
}
