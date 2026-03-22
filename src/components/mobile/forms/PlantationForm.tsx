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
import MobileCheckbox from '@/components/mobile/fields/MobileCheckbox'
import { useCachedVarieties, useCachedSeedlings, useCachedSeedLots, useCachedRows } from '@/hooks/useCachedData'
import { offlineDb } from '@/lib/offline/db'
import { generateUUID } from '@/lib/utils/uuid'
import { mobilePlantingSchema } from '@/lib/validation/parcelles'
import { todayISO } from '@/lib/utils/date'
import DateYearWarning from '@/components/shared/DateYearWarning'
import { useSpacingCalc } from '@/hooks/useSpacingCalc'

/** Formate une date ISO en JJ/MM/AAAA */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TYPE_PLANT_OPTIONS = [
  { value: 'godet', label: 'Godet' },
  { value: 'caissette', label: 'Caissette' },
  { value: 'mini_motte', label: 'Mini-motte' },
  { value: 'plant_achete', label: 'Plant acheté' },
  { value: 'division', label: 'Division' },
  { value: 'bouture', label: 'Bouture' },
  { value: 'marcottage', label: 'Marcottage' },
  { value: 'stolon', label: 'Stolon' },
  { value: 'rhizome', label: 'Rhizome' },
  { value: 'semis_direct', label: 'Semis direct' },
]

const LUNE_OPTIONS = [
  { value: 'montante', label: 'Montante' },
  { value: 'descendante', label: 'Descendante' },
]

function initialState() {
  return {
    row_id: '',
    variety_id: '',
    seedling_id: '',
    annee: new Date().getFullYear().toString(),
    date_plantation: todayISO(),
    lune: '',
    nb_plants: '',
    type_plant: '',
    espacement_cm: '',
    longueur_m: '',
    largeur_m: '',
    certif_ab: false,
    temps_min: '',
    commentaire: '',
  }
}

interface PlantationFormProps {
  orgSlug: string
}

/** Formulaire mobile — Plantation (plantings) */
export default function PlantationForm({ orgSlug }: PlantationFormProps) {
  const { addEntry, farmId, certifBio } = useMobileSync()
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()
  const { seedlings, isLoading: seedlingsLoading } = useCachedSeedlings()
  const { seedLots } = useCachedSeedLots()

  const [form, setForm] = useState(() => ({ ...initialState(), certif_ab: certifBio }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const { rows: cachedRows } = useCachedRows()
  const { autoField, computeSpacing, markManual, resetSpacing } = useSpacingCalc()

  /** Met à jour un champ d'espacement et auto-calcule le 3e si possible */
  const setSpacingField = useCallback(
    (field: 'nb_plants' | 'espacement_cm' | 'longueur_m', value: string) => {
      setForm(prev => {
        const updated = { ...prev, [field]: value }
        const result = computeSpacing(field, value, {
          nb_plants: updated.nb_plants,
          espacement_cm: updated.espacement_cm,
          longueur_m: updated.longueur_m,
        })
        if (result) {
          return { ...updated, [result.field]: result.value }
        }
        return updated
      })
      setErrors(prev => {
        if (!prev[field]) return prev
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [computeSpacing],
  )

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
      seedling_id: form.seedling_id || null,
      annee: form.annee ? parseInt(form.annee, 10) : undefined,
      date_plantation: form.date_plantation,
      lune: form.lune || null,
      nb_plants: form.nb_plants ? parseInt(form.nb_plants, 10) : null,
      type_plant: form.type_plant,
      espacement_cm: form.espacement_cm ? parseInt(form.espacement_cm, 10) : null,
      longueur_m: form.longueur_m ? parseFloat(form.longueur_m) : null,
      largeur_m: form.largeur_m ? parseFloat(form.largeur_m) : null,
      certif_ab: form.certif_ab,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

    const result = mobilePlantingSchema.safeParse(payload)
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
        table_cible: 'plantings',
        farm_id: farmId,
        payload: result.data as unknown as Record<string, unknown>,
      })

      // Mettre a jour le cache local des plantings pour que les selecteurs de rang se mettent a jour
      const variety = varieties.find(v => v.id === form.variety_id)
      if (variety && form.row_id) {
        await offlineDb.plantings.add({
          id: generateUUID(),
          row_id: form.row_id,
          variety_id: form.variety_id,
          variety_name: variety.nom_vernaculaire,
          actif: true,
        })
      }

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
    resetSpacing()
  }

  /** Pré-remplir longueur/largeur depuis le rang sélectionné */
  const handleRowChange = useCallback(
    (rowId: string) => {
      set('row_id', rowId)
      if (rowId) {
        const row = cachedRows.find(r => r.id === rowId)
        if (row) {
          if (row.longueur_m != null) {
            set('longueur_m', row.longueur_m.toString())
            markManual('longueur_m')
          }
          if (row.largeur_m != null) {
            set('largeur_m', row.largeur_m.toString())
          }
        }
      }
    },
    [set, cachedRows, markManual],
  )

  const backHref = `/${orgSlug}/m/saisie/parcelle`

  const varietyOptions = varieties.map((v) => ({
    value: v.id,
    label: v.nom_vernaculaire,
    sublabel: v.nom_latin ?? undefined,
  }))

  // Filtrer les semis par variété sélectionnée
  const filteredSeedlings = useMemo(() => {
    const available = seedlings.filter(s => s.plants_restants === null || s.plants_restants > 0)
    if (!form.variety_id) return available
    return available.filter(s => s.variety_id === form.variety_id)
  }, [seedlings, form.variety_id])

  const seedlingOptions = filteredSeedlings.map((s) => ({
    value: s.id,
    label: `${s.processus === 'mini_motte' ? 'MM' : 'CG'} — ${fmtDate(s.date_semis)}${s.numero_caisse ? ` — Caisse ${s.numero_caisse}` : ''}${s.nb_plants_obtenus ? ` — ${s.nb_plants_obtenus} plants` : ''}`,
  }))

  // Semis sélectionné + sachet lié pour la chaîne de traçabilité
  const selectedSeedling = seedlings.find(s => s.id === form.seedling_id) ?? null
  const linkedSeedLot = selectedSeedling?.seed_lot_id
    ? seedLots.find(sl => sl.id === selectedSeedling.seed_lot_id) ?? null
    : null

  return (
    <MobileFormLayout
      title="Plantation"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
      onReset={handleReset}
    >
      <MobileRowSelect
        value={form.row_id}
        onChange={handleRowChange}
        error={errors.row_id}
      />

      <MobileSearchSelect
        label="Variété"
        required
        value={form.variety_id}
        onChange={(v) => {
          set('variety_id', v)
          set('seedling_id', '')
        }}
        options={varietyOptions}
        placeholder={varietiesLoading ? 'Chargement…' : 'Sélectionner une variété'}
        searchPlaceholder="Rechercher une variété..."
        error={errors.variety_id}
      />

      <MobileSelect
        label="Semis source (optionnel)"
        value={form.seedling_id}
        onChange={(v) => set('seedling_id', v)}
        options={[{ value: '', label: 'Aucun (plant acheté ou autre)' }, ...seedlingOptions]}
        placeholder={seedlingsLoading ? 'Chargement…' : 'Aucun (plant acheté ou autre)'}
        error={errors.seedling_id}
      />

      {/* Chaîne de traçabilité */}
      {selectedSeedling && (
        <div
          className="rounded-xl px-3 py-2.5 text-xs"
          style={{ backgroundColor: '#F5F2ED', border: '1px solid #E8E3DB', color: '#6B7B6C' }}
        >
          <p>
            Semis du {fmtDate(selectedSeedling.date_semis)}
            {' ('}
            {selectedSeedling.processus === 'mini_motte' ? 'mini-mottes' : 'caissette/godet'}
            {selectedSeedling.numero_caisse ? `, Caisse ${selectedSeedling.numero_caisse}` : ''}
            {')'}
          </p>
          {linkedSeedLot && (
            <p style={{ marginTop: 2 }}>
              {'← Sachet '}
              {linkedSeedLot.lot_interne}
              {linkedSeedLot.fournisseur ? ` — ${linkedSeedLot.fournisseur}` : ''}
              {linkedSeedLot.certif_ab ? ' — AB' : ''}
            </p>
          )}
        </div>
      )}

      <MobileInput
        label="Année"
        required
        type="number"
        value={form.annee}
        onChange={(v) => set('annee', v)}
        error={errors.annee}
      />

      <MobileInput
        label="Date plantation"
        required
        type="date"
        value={form.date_plantation}
        onChange={(v) => set('date_plantation', v)}
        error={errors.date_plantation}
      />
      <DateYearWarning date={form.date_plantation} />

      <MobileSelect
        label="Lune"
        value={form.lune}
        onChange={(v) => set('lune', v)}
        options={LUNE_OPTIONS}
        placeholder="(optionnel)"
        error={errors.lune}
      />

      <MobileInput
        label={`Nb plants${autoField === 'nb_plants' ? ' (auto)' : ''}`}
        type="number"
        value={form.nb_plants}
        onChange={(v) => setSpacingField('nb_plants', v)}
        placeholder="0"
        error={errors.nb_plants}
      />

      <MobileSelect
        label="Type de plant"
        required
        value={form.type_plant}
        onChange={(v) => set('type_plant', v)}
        options={TYPE_PLANT_OPTIONS}
        error={errors.type_plant}
      />

      <MobileInput
        label={`Espacement${autoField === 'espacement_cm' ? ' (auto)' : ''}`}
        type="number"
        value={form.espacement_cm}
        onChange={(v) => setSpacingField('espacement_cm', v)}
        placeholder="0"
        suffix="cm"
        error={errors.espacement_cm}
      />

      <MobileInput
        label={`Longueur${autoField === 'longueur_m' ? ' (auto)' : ''}`}
        type="number"
        value={form.longueur_m}
        onChange={(v) => setSpacingField('longueur_m', v)}
        placeholder="0"
        suffix="m"
        error={errors.longueur_m}
      />

      {/* Résumé espacement */}
      {parseFloat(form.nb_plants) > 0 && parseFloat(form.espacement_cm) > 0 && parseFloat(form.longueur_m) > 0 && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{ backgroundColor: '#F0F4F0', color: '#6B7B6C', border: '1px solid #E0E6E0' }}
        >
          {form.nb_plants} plants × {form.espacement_cm} cm = {(parseFloat(form.nb_plants) * parseFloat(form.espacement_cm) / 100).toFixed(1)} m
        </div>
      )}

      <MobileInput
        label="Largeur"
        type="number"
        value={form.largeur_m}
        onChange={(v) => set('largeur_m', v)}
        placeholder="0"
        suffix="m"
        error={errors.largeur_m}
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
