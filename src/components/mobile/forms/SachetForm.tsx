'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import MobileCheckbox from '@/components/mobile/fields/MobileCheckbox'
import { useCachedVarieties } from '@/hooks/useCachedData'
import { seedLotSchema } from '@/lib/validation/semis'
import { todayISO } from '@/lib/utils/date'

/** État initial du formulaire */
function initialState() {
  return {
    variety_id: '',
    fournisseur: '',
    numero_lot_fournisseur: '',
    date_achat: todayISO(),
    date_facture: '',
    numero_facture: '',
    poids_sachet_g: '',
    certif_ab: false,
    commentaire: '',
  }
}

interface SachetFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Sachet de graines (seed_lots).
 * Validation Zod partagée avec le bureau.
 */
export default function SachetForm({ orgSlug }: SachetFormProps) {
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
      // Effacer l'erreur du champ modifié
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

    // Construire le payload pour validation Zod
    const payload = {
      variety_id: form.variety_id,
      fournisseur: form.fournisseur || null,
      numero_lot_fournisseur: form.numero_lot_fournisseur || null,
      date_achat: form.date_achat,
      date_facture: form.date_facture || null,
      numero_facture: form.numero_facture || null,
      poids_sachet_g: form.poids_sachet_g ? parseFloat(form.poids_sachet_g) : null,
      certif_ab: form.certif_ab,
      commentaire: form.commentaire || null,
    }

    const result = seedLotSchema.safeParse(payload)
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
        table_cible: 'seed_lots',
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

  return (
    <MobileFormLayout
      title="Sachet de graines"
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

      {varieties.length === 0 && !varietiesLoading && (
        <p className="text-xs" style={{ color: '#999', marginTop: -8 }}>
          Variété manquante ? Notez le nom en commentaire et ajoutez-la au retour en Wi-Fi.
        </p>
      )}

      <MobileInput
        label="Fournisseur"
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

      <MobileInput
        label="Date d'achat"
        required
        type="date"
        value={form.date_achat}
        onChange={(v) => set('date_achat', v)}
        error={errors.date_achat}
      />

      <MobileInput
        label="Date facture"
        type="date"
        value={form.date_facture}
        onChange={(v) => set('date_facture', v)}
        error={errors.date_facture}
      />

      <MobileInput
        label="N° facture"
        value={form.numero_facture}
        onChange={(v) => set('numero_facture', v)}
        placeholder="Numéro de facture"
        error={errors.numero_facture}
      />

      <MobileInput
        label="Poids sachet"
        type="number"
        value={form.poids_sachet_g}
        onChange={(v) => set('poids_sachet_g', v)}
        placeholder="0"
        suffix="g"
        error={errors.poids_sachet_g}
      />

      <MobileCheckbox
        label="Certifié AB"
        checked={form.certif_ab}
        onChange={(v) => set('certif_ab', v)}
      />
      {certifBio && (
        <p className="text-xs" style={{ color: '#9CA89D', marginTop: -8 }}>
          Pré-coché (ferme bio)
        </p>
      )}

      <MobileTextarea
        label="Commentaire"
        value={form.commentaire}
        onChange={(v) => set('commentaire', v)}
        placeholder="Notes, observations…"
      />
    </MobileFormLayout>
  )
}
