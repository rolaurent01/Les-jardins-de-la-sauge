'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import MobileCheckbox from '@/components/mobile/fields/MobileCheckbox'
import { useCachedVarieties } from '@/hooks/useCachedData'
import { purchaseSchema } from '@/lib/validation/affinage-stock'

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

const ETAT_PLANTE_OPTIONS = [
  { value: 'frais', label: 'Frais' },
  { value: 'tronconnee', label: 'Tronçonnée' },
  { value: 'sechee', label: 'Séchée' },
  { value: 'tronconnee_sechee', label: 'Tronçonnée séchée' },
  { value: 'sechee_triee', label: 'Séchée triée' },
  { value: 'tronconnee_sechee_triee', label: 'Tronçonnée séchée triée' },
]

function initialState() {
  return {
    variety_id: '',
    partie_plante: '',
    etat_plante: '',
    date: todayISO(),
    poids_g: '',
    fournisseur: '',
    numero_lot_fournisseur: '',
    certif_ab: false,
    prix: '',
    commentaire: '',
  }
}

interface AchatFormProps {
  orgSlug: string
}

/** Formulaire mobile — Achat externe (stock_purchases). */
export default function AchatForm({ orgSlug }: AchatFormProps) {
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
      variety_id: form.variety_id,
      partie_plante: form.partie_plante,
      etat_plante: form.etat_plante,
      date: form.date,
      poids_g: form.poids_g ? parseFloat(form.poids_g) : undefined,
      fournisseur: form.fournisseur,
      numero_lot_fournisseur: form.numero_lot_fournisseur || null,
      certif_ab: form.certif_ab,
      prix: form.prix ? parseFloat(form.prix) : null,
      commentaire: form.commentaire || null,
    }

    const result = purchaseSchema.safeParse(payload)
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
        table_cible: 'stock_purchases',
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

  const backHref = `/${orgSlug}/m/saisie/stock`

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
  }))

  return (
    <MobileFormLayout
      title="Achat externe"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      <MobileSelect
        label="Variété"
        required
        value={form.variety_id}
        onChange={(v) => set('variety_id', v)}
        options={varietyOptions}
        placeholder={varietiesLoading ? 'Chargement…' : 'Sélectionner une variété'}
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

      <MobileSelect
        label="État plante"
        required
        value={form.etat_plante}
        onChange={(v) => set('etat_plante', v)}
        options={ETAT_PLANTE_OPTIONS}
        error={errors.etat_plante}
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

      <MobileInput
        label="Fournisseur"
        required
        value={form.fournisseur}
        onChange={(v) => set('fournisseur', v)}
        placeholder="Nom du fournisseur"
        error={errors.fournisseur}
      />

      <MobileInput
        label="N° lot fournisseur"
        value={form.numero_lot_fournisseur}
        onChange={(v) => set('numero_lot_fournisseur', v)}
        placeholder="Référence lot"
        error={errors.numero_lot_fournisseur}
      />

      <MobileCheckbox
        label="Certifié AB"
        checked={form.certif_ab}
        onChange={(v) => set('certif_ab', v)}
      />

      <MobileInput
        label="Prix"
        type="number"
        value={form.prix}
        onChange={(v) => set('prix', v)}
        placeholder="0"
        suffix="€"
        error={errors.prix}
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
