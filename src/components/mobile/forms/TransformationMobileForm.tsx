'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties, useCachedStock, useCachedDryingInProgress } from '@/hooks/useCachedData'
import type { ZodSchema } from 'zod'
import { todayISO } from '@/lib/utils/date'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import { ETAT_PLANTE_LABELS } from '@/lib/constants/etat-plante'
import type { PartiePlante } from '@/lib/types'
import DateYearWarning from '@/components/shared/DateYearWarning'

type TypeEntreeSortie = 'entree' | 'sortie'

/** Options d'état plante par type (entrée/sortie) */
interface EtatPlanteConfig {
  entree: { value: string; label: string }[]
  sortie: { value: string; label: string }[]
}

interface TransformationMobileFormProps {
  orgSlug: string
  title: string
  tableCible: 'cuttings' | 'dryings' | 'sortings'
  schema: ZodSchema
  backCategory: string
  etatPlanteConfig: EtatPlanteConfig | null
  getImplicitEtatPlante?: (type: TypeEntreeSortie) => string
  /** États plante acceptés en entrée pour filtrer le stock dispo */
  stockEntreeEtats?: string[]
}

/** Clé composite */
function compositeKeyOf(s: { variety_id: string; partie_plante: string; etat: string }): string {
  return `${s.variety_id}::${s.partie_plante}::${s.etat}`
}

function parseCompositeKey(key: string): { variety_id: string; partie_plante: string; etat: string } | null {
  const parts = key.split('::')
  if (parts.length !== 3) return null
  return { variety_id: parts[0], partie_plante: parts[1], etat: parts[2] }
}

function formatStockG(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

/** Déduit l'état de sortie séchage depuis l'état d'entrée */
const ENTREE_TO_SORTIE_ETAT: Record<string, string> = {
  frais: 'sechee',
  tronconnee: 'tronconnee_sechee',
}

function initialState() {
  return {
    type: 'entree' as TypeEntreeSortie,
    picker_key: '',
    variety_id: '',
    partie_plante: '',
    date: todayISO(),
    poids_g: '',
    temps_min: '',
    etat_plante: '',
    commentaire: '',
  }
}

export default function TransformationMobileForm({
  orgSlug,
  title,
  tableCible,
  schema,
  backCategory,
  etatPlanteConfig,
  getImplicitEtatPlante,
  stockEntreeEtats,
}: TransformationMobileFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { varieties } = useCachedVarieties()
  const { stock } = useCachedStock()
  const { dryingInProgress } = useCachedDryingInProgress()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const isEntree = form.type === 'entree'
  const isSortieWithDrying = !isEntree && dryingInProgress.length > 0

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

  // Map variétés par id
  const varietyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of varieties) m.set(v.id, v.nom_vernaculaire)
    return m
  }, [varieties])

  // Options du sélecteur stock (entrée)
  const stockOptions = useMemo(() => {
    if (!isEntree || !stockEntreeEtats?.length) return []
    return stock
      .filter(s => stockEntreeEtats.includes(s.etat_plante) && s.stock_g > 0)
      .sort((a, b) => {
        const na = varietyMap.get(a.variety_id) ?? ''
        const nb = varietyMap.get(b.variety_id) ?? ''
        return na.localeCompare(nb, 'fr', { sensitivity: 'base' })
      })
      .map(s => ({
        value: compositeKeyOf({ variety_id: s.variety_id, partie_plante: s.partie_plante, etat: s.etat_plante }),
        label: varietyMap.get(s.variety_id) ?? 'Inconnue',
        sublabel: `${PARTIE_PLANTE_LABELS[s.partie_plante as PartiePlante] ?? s.partie_plante} — ${ETAT_PLANTE_LABELS[s.etat_plante] ?? s.etat_plante} — ${formatStockG(s.stock_g)}`,
      }))
  }, [isEntree, stock, stockEntreeEtats, varietyMap])

  // Options du sélecteur "en séchage" (sortie)
  const dryingOptions = useMemo(() => {
    if (!isSortieWithDrying) return []
    return dryingInProgress
      .filter(d => d.en_sechage_g > 0)
      .sort((a, b) => {
        const na = varietyMap.get(a.variety_id) ?? ''
        const nb = varietyMap.get(b.variety_id) ?? ''
        return na.localeCompare(nb, 'fr', { sensitivity: 'base' })
      })
      .map(d => ({
        value: compositeKeyOf({ variety_id: d.variety_id, partie_plante: d.partie_plante, etat: d.etat_plante_entree }),
        label: varietyMap.get(d.variety_id) ?? 'Inconnue',
        sublabel: `${PARTIE_PLANTE_LABELS[d.partie_plante as PartiePlante] ?? d.partie_plante} — ${ETAT_PLANTE_LABELS[d.etat_plante_entree] ?? d.etat_plante_entree} — ${formatStockG(d.en_sechage_g)} en séchage`,
      }))
  }, [isSortieWithDrying, dryingInProgress, varietyMap])

  // Stock/séchage dispo pour la ligne sélectionnée
  const selectedDispo = useMemo(() => {
    if (!form.picker_key) return null
    if (isEntree) {
      const entry = stock.find(s =>
        compositeKeyOf({ variety_id: s.variety_id, partie_plante: s.partie_plante, etat: s.etat_plante }) === form.picker_key
      )
      return entry?.stock_g ?? null
    }
    if (isSortieWithDrying) {
      const entry = dryingInProgress.find(d =>
        compositeKeyOf({ variety_id: d.variety_id, partie_plante: d.partie_plante, etat: d.etat_plante_entree }) === form.picker_key
      )
      return entry?.en_sechage_g ?? null
    }
    return null
  }, [form.picker_key, isEntree, isSortieWithDrying, stock, dryingInProgress])

  function handlePickerSelect(key: string) {
    set('picker_key', key)
    const parsed = parseCompositeKey(key)
    if (parsed) {
      set('variety_id', parsed.variety_id)
      set('partie_plante', parsed.partie_plante)
      if (isEntree) {
        set('etat_plante', parsed.etat)
      } else {
        // Sortie : déduire l'état de sortie depuis l'état d'entrée
        set('etat_plante', ENTREE_TO_SORTIE_ETAT[parsed.etat] ?? parsed.etat)
      }
    } else {
      set('variety_id', '')
      set('partie_plante', '')
      set('etat_plante', '')
    }
  }

  function handleTypeChange(type: TypeEntreeSortie) {
    set('type', type)
    set('picker_key', '')
    set('variety_id', '')
    set('partie_plante', '')
    set('etat_plante', '')
  }

  const handleSubmit = async () => {
    setGlobalError(null)

    const basePayload = {
      variety_id: form.variety_id,
      partie_plante: form.partie_plante,
      type: form.type,
      date: form.date,
      poids_g: form.poids_g ? parseFloat(form.poids_g) : undefined,
      temps_min: form.temps_min ? parseInt(form.temps_min, 10) : null,
      commentaire: form.commentaire || null,
    }

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
              onClick={() => handleTypeChange(opt.value)}
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

      {/* ============================================================ */}
      {/* MODE ENTREE : Sélecteur stock source                         */}
      {/* ============================================================ */}
      {isEntree && (
        <>
          <MobileSearchSelect
            label="Stock source"
            required
            value={form.picker_key}
            onChange={handlePickerSelect}
            options={stockOptions}
            placeholder={stockOptions.length === 0 ? 'Aucun stock disponible' : 'Choisir dans le stock'}
            searchPlaceholder="Rechercher une variété..."
            error={errors.variety_id || errors.partie_plante || errors.etat_plante}
          />

          {selectedDispo !== null && (
            <div
              className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                backgroundColor: selectedDispo > 0 ? '#F0F4F0' : '#FEF3C7',
                border: `1px solid ${selectedDispo > 0 ? '#E0E6E0' : '#F59E0B44'}`,
                color: selectedDispo > 0 ? '#6B7B6C' : '#92400E',
              }}
            >
              Stock dispo : {formatStockG(selectedDispo)}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODE SORTIE + séchage en cours                               */}
      {/* ============================================================ */}
      {isSortieWithDrying && (
        <>
          <MobileSearchSelect
            label="En cours de séchage"
            required
            value={form.picker_key}
            onChange={handlePickerSelect}
            options={dryingOptions}
            placeholder={dryingOptions.length === 0 ? 'Rien en séchage' : 'Choisir dans le séchoir'}
            searchPlaceholder="Rechercher une variété..."
            error={errors.variety_id || errors.partie_plante || errors.etat_plante}
          />

          {selectedDispo !== null && (
            <div
              className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                backgroundColor: '#EDE9FE',
                border: '1px solid #C4B5FD44',
                color: '#5B21B6',
              }}
            >
              En séchage : {formatStockG(selectedDispo)} — sortira en {ETAT_PLANTE_LABELS[form.etat_plante] ?? form.etat_plante}
            </div>
          )}
        </>
      )}

      <MobileInput
        label="Date"
        required
        type="date"
        value={form.date}
        onChange={(v) => set('date', v)}
        error={errors.date}
      />
      <DateYearWarning date={form.date} />

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
