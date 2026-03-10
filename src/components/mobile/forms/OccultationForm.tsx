'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileRowSelect from '@/components/mobile/fields/MobileRowSelect'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import MobileCheckbox from '@/components/mobile/fields/MobileCheckbox'
import { occultationSchema } from '@/lib/validation/parcelles'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const METHODE_OPTIONS = [
  { value: 'paille', label: 'Paille' },
  { value: 'foin', label: 'Foin' },
  { value: 'bache', label: 'Bâche' },
  { value: 'engrais_vert', label: 'Engrais vert' },
]

type Methode = 'paille' | 'foin' | 'bache' | 'engrais_vert' | ''

function initialState() {
  return {
    row_id: '',
    date_debut: todayISO(),
    methode: '' as Methode,
    // Paille / Foin
    fournisseur: '',
    attestation: '',
    // Engrais vert
    engrais_vert_nom: '',
    engrais_vert_fournisseur: '',
    engrais_vert_facture: '',
    engrais_vert_certif_ab: false,
    // Commun
    temps_min: '',
    commentaire: '',
  }
}

interface OccultationFormProps {
  orgSlug: string
}

/** Formulaire mobile — Occultation (occultations). Adaptatif selon la méthode. */
export default function OccultationForm({ orgSlug }: OccultationFormProps) {
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

  const methode = form.methode

  const handleSubmit = async () => {
    setGlobalError(null)

    const payload = {
      row_id: form.row_id,
      date_debut: form.date_debut,
      methode: form.methode,
      // Paille / Foin
      fournisseur: (methode === 'paille' || methode === 'foin') ? (form.fournisseur || null) : null,
      attestation: methode === 'paille' ? (form.attestation || null) : null,
      // Engrais vert
      engrais_vert_nom: methode === 'engrais_vert' ? (form.engrais_vert_nom || null) : null,
      engrais_vert_fournisseur: methode === 'engrais_vert' ? (form.engrais_vert_fournisseur || null) : null,
      engrais_vert_facture: methode === 'engrais_vert' ? (form.engrais_vert_facture || null) : null,
      engrais_vert_certif_ab: methode === 'engrais_vert' ? form.engrais_vert_certif_ab : false,
      // Pas de date_fin ni temps_retrait_min à la création
      date_fin: null,
      temps_retrait_min: null,
      // Commun
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = occultationSchema.safeParse(payload)
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
        table_cible: 'occultations',
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
      title="Occultation"
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
        label="Date début"
        required
        type="date"
        value={form.date_debut}
        onChange={(v) => set('date_debut', v)}
        error={errors.date_debut}
      />

      <MobileSelect
        label="Méthode"
        required
        value={form.methode}
        onChange={(v) => set('methode', v as Methode)}
        options={METHODE_OPTIONS}
        error={errors.methode}
      />

      {/* Champs conditionnels — Paille ou Foin */}
      {(methode === 'paille' || methode === 'foin') && (
        <>
          <MobileInput
            label="Fournisseur"
            required
            value={form.fournisseur}
            onChange={(v) => set('fournisseur', v)}
            placeholder="Nom du fournisseur"
            error={errors.fournisseur}
          />
          {methode === 'paille' && (
            <MobileInput
              label="Attestation"
              value={form.attestation}
              onChange={(v) => set('attestation', v)}
              placeholder="Référence attestation"
              error={errors.attestation}
            />
          )}
        </>
      )}

      {/* Champs conditionnels — Engrais vert */}
      {methode === 'engrais_vert' && (
        <>
          <MobileInput
            label="Nom engrais vert"
            required
            value={form.engrais_vert_nom}
            onChange={(v) => set('engrais_vert_nom', v)}
            placeholder="Type d'engrais vert"
            error={errors.engrais_vert_nom}
          />
          <MobileInput
            label="Fournisseur engrais vert"
            required
            value={form.engrais_vert_fournisseur}
            onChange={(v) => set('engrais_vert_fournisseur', v)}
            placeholder="Nom du fournisseur"
            error={errors.engrais_vert_fournisseur}
          />
          <MobileInput
            label="N° facture"
            value={form.engrais_vert_facture}
            onChange={(v) => set('engrais_vert_facture', v)}
            placeholder="Numéro de facture"
            error={errors.engrais_vert_facture}
          />
          <MobileCheckbox
            label="Certifié AB"
            checked={form.engrais_vert_certif_ab}
            onChange={(v) => set('engrais_vert_certif_ab', v)}
          />
        </>
      )}

      {/* Commun */}
      <MobileInput
        label="Temps"
        type="number"
        value={form.temps_min}
        onChange={(v) => set('temps_min', v)}
        placeholder="0"
        suffix="min"
        showTimerInsert
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
