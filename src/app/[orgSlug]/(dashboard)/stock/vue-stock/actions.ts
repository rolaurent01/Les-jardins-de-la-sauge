'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'

/** Ligne de stock brute depuis v_stock + jointure varieties */
export interface StockEntry {
  variety_id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  partie_plante: string
  etat_plante: string
  stock_g: number
}

/** Alerte stock bas (stock total < seuil) */
export interface StockAlert {
  variety_id: string
  nom_vernaculaire: string
  stock_total_g: number
  seuil_g: number
}

/**
 * Récupère le stock temps réel depuis v_stock,
 * enrichi avec les infos variété (nom, famille).
 * Tri : famille → nom_vernaculaire → partie_plante → etat_plante
 */
export async function fetchStock(): Promise<StockEntry[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('v_stock')
    .select('variety_id, partie_plante, etat_plante, stock_g')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur v_stock : ${error.message}`)
  if (!data || data.length === 0) return []

  return enrichStockRows(supabase, data)
}

/**
 * Récupère le stock à une date donnée via la fonction SQL stock_at_date.
 */
export async function fetchStockAtDate(date: string): Promise<StockEntry[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('stock_at_date', {
    p_farm_id: farmId,
    p_date: date,
  })

  if (error) throw new Error(`Erreur stock_at_date : ${error.message}`)
  if (!data || data.length === 0) return []

  return enrichStockRows(supabase, data)
}

/** Enrichit les lignes de stock brutes avec les infos variété */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichStockRows(supabase: any, data: { variety_id: string; partie_plante: string; etat_plante: string; stock_g: number }[]): Promise<StockEntry[]> {
  const varietyIds = [...new Set(data.map(d => d.variety_id))]
  const { data: varieties, error: vErr } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille')
    .in('id', varietyIds)

  if (vErr) throw new Error(`Erreur variétés : ${vErr.message}`)

  type VarietyInfo = { id: string; nom_vernaculaire: string; nom_latin: string | null; famille: string | null }
  const varietyMap = new Map<string, VarietyInfo>(
    (varieties ?? []).map((v: VarietyInfo) => [v.id, v])
  )

  const entries: StockEntry[] = data.map(row => {
    const v = varietyMap.get(row.variety_id)
    return {
      variety_id: row.variety_id,
      nom_vernaculaire: v?.nom_vernaculaire ?? 'Inconnue',
      nom_latin: v?.nom_latin ?? null,
      famille: v?.famille ?? null,
      partie_plante: row.partie_plante,
      etat_plante: row.etat_plante,
      stock_g: Number(row.stock_g),
    }
  })

  // Tri : famille → nom_vernaculaire → partie_plante → etat_plante
  entries.sort((a, b) => {
    const fa = a.famille ?? ''
    const fb = b.famille ?? ''
    if (fa !== fb) return fa.localeCompare(fb, 'fr')
    if (a.nom_vernaculaire !== b.nom_vernaculaire)
      return a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr')
    if (a.partie_plante !== b.partie_plante)
      return a.partie_plante.localeCompare(b.partie_plante, 'fr')
    return a.etat_plante.localeCompare(b.etat_plante, 'fr')
  })

  return entries
}

/**
 * Récupère les années distinctes ayant des mouvements de stock + année courante.
 */
export async function fetchStockYears(): Promise<number[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('stock_movements')
    .select('date')
    .eq('farm_id', farmId)
    .is('deleted_at', null)

  if (error) throw new Error(`Erreur stock_movements : ${error.message}`)

  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>([currentYear])
  for (const row of data ?? []) {
    if (row.date) yearsSet.add(new Date(row.date).getFullYear())
  }

  return Array.from(yearsSet).sort((a, b) => a - b)
}

/**
 * Compare le stock total par variété avec farm_variety_settings.seuil_alerte_g.
 * Retourne les variétés dont le stock total est sous le seuil.
 */
export async function fetchStockAlerts(): Promise<StockAlert[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  // Récupérer les seuils configurés pour cette ferme
  const { data: settings, error: sErr } = await supabase
    .from('farm_variety_settings')
    .select('variety_id, seuil_alerte_g')
    .eq('farm_id', farmId)
    .not('seuil_alerte_g', 'is', null)

  if (sErr) throw new Error(`Erreur farm_variety_settings : ${sErr.message}`)
  if (!settings || settings.length === 0) return []

  // Récupérer le stock total par variété
  const { data: stockData, error: stErr } = await supabase
    .from('v_stock')
    .select('variety_id, stock_g')
    .eq('farm_id', farmId)

  if (stErr) throw new Error(`Erreur v_stock alertes : ${stErr.message}`)

  // Agréger stock par variété
  const stockByVariety = new Map<string, number>()
  for (const row of stockData ?? []) {
    const current = stockByVariety.get(row.variety_id) ?? 0
    stockByVariety.set(row.variety_id, current + Number(row.stock_g))
  }

  // Récupérer les noms des variétés avec seuil
  const seuilVarietyIds = settings.map(s => s.variety_id)
  const { data: varieties } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire')
    .in('id', seuilVarietyIds)

  const nameMap = new Map(
    (varieties ?? []).map(v => [v.id, v.nom_vernaculaire])
  )

  const alerts: StockAlert[] = []
  for (const s of settings) {
    const seuil = Number(s.seuil_alerte_g)
    const stockTotal = stockByVariety.get(s.variety_id) ?? 0
    if (stockTotal < seuil) {
      alerts.push({
        variety_id: s.variety_id,
        nom_vernaculaire: nameMap.get(s.variety_id) ?? 'Inconnue',
        stock_total_g: stockTotal,
        seuil_g: seuil,
      })
    }
  }

  return alerts
}
