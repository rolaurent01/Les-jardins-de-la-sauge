'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileSearchSelect from '@/components/mobile/fields/MobileSearchSelect'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import { useCachedVarieties, useCachedStock } from '@/hooks/useCachedData'
import type { ZodSchema } from 'zod'
import { todayISO } from '@/lib/utils/date'
import { PARTIE_PLANTE_LABELS } from '@/lib/types'
import { ETAT_PLANTE_LABELS } from '@/lib/constants/etat-plante'
import type { PartiePlante } from '@/lib/types'
import DateYearWarning from '@/components/shared/DateYearWarning'

interface CombinedTransformationMobileFormProps {
  orgSlug: string
  title: string
  /** Table cible combinee pour le sync */
  tableCible: 'cuttings_combined' | 'sortings_combined'
  schema: ZodSchema
  backCategory: string
  /** Si fourni, affiche le selecteur d'etat plante (entree uniquement) */
  etatPlanteConfig?: { entree: { value: string; label: string }[] } | null
  /** Pre-remplir poids sortie = poids entree (tronconnage) */
  autoSyncPoidsSortie?: boolean
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
    stock_key: '',
    variety_id: '',
    partie_plante: '',
    etat_plante: '',
    date: todayISO(),
    poids_entree_g: '',
    poids_sortie_g: '',
    temps_min: '',
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
  stockEntreeEtats,
}: CombinedTransformationMobileFormProps) {
  const { addEntry, farmId } = useMobileSync()
  const { varieties } = useCachedVarieties()
  const { stock } = useCachedStock()

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

  // Map variétés par id pour lookup rapide
  const varietyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of varieties) m.set(v.id, v.nom_vernaculaire)
    return m
  }, [varieties])

  // Options du sélecteur stock : lignes de stock filtrées par états acceptés
  const stockOptions = useMemo(() => {
    if (!stockEntreeEtats?.length) return []
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
  }, [stock, stockEntreeEtats, varietyMap])

  // Stock dispo pour la ligne sélectionnée
  const stockDispo = useMemo(() => {
    if (!form.stock_key) return null
    const entry = stock.find(s => stockKeyOf(s) === form.stock_key)
    return entry?.stock_g ?? null
  }, [stock, form.stock_key])

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
      {/* Sélecteur stock source */}
      <MobileSearchSelect
        label="Stock source"
        required
        value={form.stock_key}
        onChange={handleStockSelect}
        options={stockOptions}
        placeholder={stockOptions.length === 0 ? 'Aucun stock disponible' : 'Choisir dans le stock'}
        searchPlaceholder="Rechercher une variété..."
        error={errors.variety_id || errors.partie_plante}
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

      {/* Warning si poids > stock */}
      {stockDispo !== null && poidsEntreeNum > stockDispo && (
        <div
          className="rounded-xl px-3 py-2.5 text-xs"
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B44',
            color: '#92400E',
          }}
        >
          Le poids d&apos;entree ({poidsEntreeNum} g) depasse le stock ({formatStockG(stockDispo)}).
        </div>
      )}

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
