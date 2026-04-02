'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSelect from '@/components/mobile/fields/MobileSelect'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties, useCachedStock } from '@/hooks/useCachedData'
import type { ZodSchema } from 'zod'
import { todayISO } from '@/lib/utils/date'
import { PARTIE_PLANTE_OPTIONS } from '@/lib/constants/partie-plante'
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

/** Clé composite pour identifier une ligne de stock */
function stockKeyOf(s: { variety_id: string; partie_plante: string; etat_plante: string }): string {
  return `${s.variety_id}::${s.partie_plante}::${s.etat_plante}`
}

function parseStockKey(key: string): { variety_id: string; partie_plante: string; etat_plante: string } | null {
  const parts = key.split('::')
  if (parts.length !== 3) return null
  return { variety_id: parts[0], partie_plante: parts[1], etat_plante: parts[2] }
}

function formatStockG(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

function initialState() {
  return {
    type: 'entree' as TypeEntreeSortie,
    stock_key: '',
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
  const { varieties, isLoading: varietiesLoading } = useCachedVarieties()
  const { stock } = useCachedStock()

  const [form, setForm] = useState(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const isEntree = form.type === 'entree'

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

  // Map variétés par id pour lookup rapide
  const varietyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of varieties) m.set(v.id, v.nom_vernaculaire)
    return m
  }, [varieties])

  // Options du sélecteur stock (entrée uniquement)
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
        value: stockKeyOf(s),
        label: varietyMap.get(s.variety_id) ?? 'Inconnue',
        sublabel: `${PARTIE_PLANTE_LABELS[s.partie_plante as PartiePlante] ?? s.partie_plante} — ${ETAT_PLANTE_LABELS[s.etat_plante] ?? s.etat_plante} — ${formatStockG(s.stock_g)}`,
      }))
  }, [isEntree, stock, stockEntreeEtats, varietyMap])

  // Stock dispo pour la ligne sélectionnée (entrée)
  const stockDispo = useMemo(() => {
    if (!isEntree || !form.stock_key) return null
    const entry = stock.find(s => stockKeyOf(s) === form.stock_key)
    return entry?.stock_g ?? null
  }, [isEntree, stock, form.stock_key])

  /** Options d'état plante pour sortie */
  const etatSortieOptions = useMemo(() => {
    if (!etatPlanteConfig) return []
    return etatPlanteConfig.sortie
  }, [etatPlanteConfig])

  function handleStockSelect(key: string) {
    set('stock_key', key)
    const parsed = parseStockKey(key)
    if (parsed) {
      set('variety_id', parsed.variety_id)
      set('partie_plante', parsed.partie_plante)
      set('etat_plante', parsed.etat_plante)
    } else {
      set('variety_id', '')
      set('partie_plante', '')
      set('etat_plante', '')
    }
  }

  function handleTypeChange(type: TypeEntreeSortie) {
    set('type', type)
    // Reset les champs liés au type
    set('stock_key', '')
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
      {isEntree ? (
        <>
          <MobileSearchSelect
            label="Stock source"
            required
            value={form.stock_key}
            onChange={handleStockSelect}
            options={stockOptions}
            placeholder={stockOptions.length === 0 ? 'Aucun stock disponible' : 'Choisir dans le stock'}
            searchPlaceholder="Rechercher une variété..."
            error={errors.variety_id || errors.partie_plante || errors.etat_plante}
          />

          {/* Stock disponible */}
          {stockDispo !== null && (
            <div
              className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                backgroundColor: stockDispo > 0 ? '#F0F4F0' : '#FEF3C7',
                border: `1px solid ${stockDispo > 0 ? '#E0E6E0' : '#F59E0B44'}`,
                color: stockDispo > 0 ? '#6B7B6C' : '#92400E',
              }}
            >
              Stock dispo : {formatStockG(stockDispo)}
            </div>
          )}
        </>
      ) : (
        /* ============================================================ */
        /* MODE SORTIE : Sélecteurs classiques                          */
        /* ============================================================ */
        <>
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

          {/* État plante sortie */}
          {etatPlanteConfig && (
            <MobileSelect
              label="État plante"
              required
              value={form.etat_plante}
              onChange={(v) => set('etat_plante', v)}
              options={etatSortieOptions}
              error={errors.etat_plante}
            />
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
