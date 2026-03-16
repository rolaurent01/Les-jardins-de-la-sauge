'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties, useCachedSeedLots } from '@/hooks/useCachedData'
import { seedlingSchema } from '@/lib/validation/semis'
import { todayISO } from '@/lib/utils/date'

type Processus = 'mini_motte' | 'caissette_godet'

/** État initial du formulaire */
function initialState(): Record<string, string | null> {
  return {
    processus: 'mini_motte',
    variety_id: '',
    seed_lot_id: '',
    date_semis: todayISO(),
    // Mini-mottes
    numero_caisse: '',
    nb_mottes: '',
    nb_mortes_mottes: '0',
    // Caissette/godet
    nb_caissettes: '',
    nb_plants_caissette: '',
    nb_mortes_caissette: '0',
    nb_godets: '',
    nb_mortes_godet: '0',
    // Commun
    nb_donnees: '0',
    nb_plants_obtenus: '',
    poids_graines_utilise_g: '',
    temps_semis_min: '',
    commentaire: '',
  }
}

interface SuiviSemisFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Suivi semis (seedlings).
 * Adaptatif selon le processus (mini-motte vs caissette/godet).
 */
export default function SuiviSemisForm({ orgSlug }: SuiviSemisFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()
  const { seedLots, isLoading: seedLotsLoading } = useCachedSeedLots()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const processus = form.processus as Processus

  const set = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Sachets filtrés par variété sélectionnée
  const filteredSeedLots = useMemo(() => {
    if (!form.variety_id) return seedLots
    return seedLots.filter((sl) => sl.variety_id === form.variety_id)
  }, [seedLots, form.variety_id])

  const seedLotOptions = filteredSeedLots.map((sl) => ({
    value: sl.id,
    label: sl.fournisseur
      ? `${sl.lot_interne} — ${sl.fournisseur}${sl.numero_lot_fournisseur ? ` #${sl.numero_lot_fournisseur}` : ''}`
      : sl.lot_interne,
  }))

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
    sublabel: v.nom_latin ?? undefined,
  }))

  /** Parse un champ numérique — retourne null si vide, le nombre sinon */
  const parseNum = (val: string | null): number | null => {
    if (!val || val.trim() === '') return null
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  /** Parse un entier — retourne null si vide */
  const parseInt_ = (val: string | null): number | null => {
    if (!val || val.trim() === '') return null
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }

  const handleSubmit = async () => {
    setGlobalError(null)

    const payload = {
      processus: form.processus,
      variety_id: form.variety_id,
      seed_lot_id: form.seed_lot_id || null,
      date_semis: form.date_semis,
      // Mini-mottes
      numero_caisse: form.numero_caisse || null,
      nb_mottes: parseInt_(form.nb_mottes),
      nb_mortes_mottes: parseInt_(form.nb_mortes_mottes) ?? 0,
      // Caissette/godet
      nb_caissettes: parseInt_(form.nb_caissettes),
      nb_plants_caissette: parseInt_(form.nb_plants_caissette),
      nb_mortes_caissette: parseInt_(form.nb_mortes_caissette) ?? 0,
      nb_godets: parseInt_(form.nb_godets),
      nb_mortes_godet: parseInt_(form.nb_mortes_godet) ?? 0,
      // Commun
      nb_donnees: parseInt_(form.nb_donnees) ?? 0,
      nb_plants_obtenus: parseInt_(form.nb_plants_obtenus),
      poids_graines_utilise_g: parseNum(form.poids_graines_utilise_g),
      temps_semis_min: parseInt_(form.temps_semis_min),
      commentaire: form.commentaire || null,
    }

    const result = seedlingSchema.safeParse(payload)
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
        table_cible: 'seedlings',
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

  const backHref = `/${orgSlug}/m/saisie/semis`

  return (
    <MobileFormLayout
      title="Suivi semis"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      {/* Toggle processus */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
          Processus <span className="text-red-500">*</span>
        </span>
        <div className="flex gap-2">
          {([
            { value: 'mini_motte', label: 'Mini-mottes' },
            { value: 'caissette_godet', label: 'Caissette / Godet' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('processus', opt.value)}
              className="flex-1 py-3 text-sm font-medium rounded-xl transition-colors"
              style={{
                backgroundColor: processus === opt.value ? 'var(--color-primary)' : '#fff',
                color: processus === opt.value ? '#fff' : '#2C3E2D',
                border: processus === opt.value ? 'none' : '1px solid #E5E5E5',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {errors.processus && (
          <p className="text-xs text-red-600">{errors.processus}</p>
        )}
      </div>

      <MobileSearchSelect
        label="Variété"
        required
        value={form.variety_id ?? ''}
        onChange={(v) => {
          set('variety_id', v)
          // Réinitialiser le sachet si la variété change
          set('seed_lot_id', '')
        }}
        options={varietyOptions}
        placeholder={varietiesLoading ? 'Chargement…' : 'Sélectionner une variété'}
        searchPlaceholder="Rechercher une variété..."
        error={errors.variety_id}
      />

      <MobileSelect
        label="Sachet source"
        value={form.seed_lot_id ?? ''}
        onChange={(v) => set('seed_lot_id', v)}
        options={seedLotOptions}
        placeholder={seedLotsLoading ? 'Chargement…' : 'Aucun (optionnel)'}
        error={errors.seed_lot_id}
      />

      <MobileInput
        label="Date semis"
        required
        type="date"
        value={form.date_semis ?? ''}
        onChange={(v) => set('date_semis', v)}
        error={errors.date_semis}
      />

      {/* Champs conditionnels — Mini-mottes */}
      {processus === 'mini_motte' && (
        <>
          <MobileInput
            label="N° caisse"
            value={form.numero_caisse ?? ''}
            onChange={(v) => set('numero_caisse', v)}
            placeholder='A, B, C…'
            error={errors.numero_caisse}
          />
          <MobileInput
            label="Nb mottes"
            required
            type="number"
            value={form.nb_mottes ?? ''}
            onChange={(v) => set('nb_mottes', v)}
            placeholder="0"
            error={errors.nb_mottes}
          />
          <MobileInput
            label="Nb mortes"
            type="number"
            value={form.nb_mortes_mottes ?? '0'}
            onChange={(v) => set('nb_mortes_mottes', v)}
            placeholder="0"
            error={errors.nb_mortes_mottes}
          />
        </>
      )}

      {/* Champs conditionnels — Caissette/Godet */}
      {processus === 'caissette_godet' && (
        <>
          <MobileInput
            label="Nb caissettes"
            required
            type="number"
            value={form.nb_caissettes ?? ''}
            onChange={(v) => set('nb_caissettes', v)}
            placeholder="0"
            error={errors.nb_caissettes}
          />
          <MobileInput
            label="Nb plants / caissette"
            required
            type="number"
            value={form.nb_plants_caissette ?? ''}
            onChange={(v) => set('nb_plants_caissette', v)}
            placeholder="0"
            error={errors.nb_plants_caissette}
          />
          <MobileInput
            label="Nb mortes caissette"
            type="number"
            value={form.nb_mortes_caissette ?? '0'}
            onChange={(v) => set('nb_mortes_caissette', v)}
            placeholder="0"
            error={errors.nb_mortes_caissette}
          />
          <MobileInput
            label="Nb godets"
            type="number"
            value={form.nb_godets ?? ''}
            onChange={(v) => set('nb_godets', v)}
            placeholder="0"
            error={errors.nb_godets}
          />
          <MobileInput
            label="Nb mortes godet"
            type="number"
            value={form.nb_mortes_godet ?? '0'}
            onChange={(v) => set('nb_mortes_godet', v)}
            placeholder="0"
            error={errors.nb_mortes_godet}
          />
        </>
      )}

      {/* Champs communs */}
      <MobileInput
        label="Nb donnés"
        type="number"
        value={form.nb_donnees ?? '0'}
        onChange={(v) => set('nb_donnees', v)}
        placeholder="0"
        error={errors.nb_donnees}
      />

      <MobileInput
        label="Nb plants obtenus"
        type="number"
        value={form.nb_plants_obtenus ?? ''}
        onChange={(v) => set('nb_plants_obtenus', v)}
        placeholder="0"
        error={errors.nb_plants_obtenus}
      />

      <MobileInput
        label="Poids graines utilisé"
        type="number"
        value={form.poids_graines_utilise_g ?? ''}
        onChange={(v) => set('poids_graines_utilise_g', v)}
        placeholder="0"
        suffix="g"
        error={errors.poids_graines_utilise_g}
      />

      <MobileTimerInput
        label="Temps semis"
        value={form.temps_semis_min ?? ''}
        onChange={(v) => set('temps_semis_min', v)}
        error={errors.temps_semis_min}
      />

      <MobileTextarea
        label="Commentaire"
        value={form.commentaire ?? ''}
        onChange={(v) => set('commentaire', v)}
        placeholder="Notes, observations…"
      />
    </MobileFormLayout>
  )
}
