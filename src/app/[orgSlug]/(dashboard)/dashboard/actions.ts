'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'

/* ─── Types ─── */

export interface TopStockRow {
  variety_id: string
  nom_vernaculaire: string
  total_g: number
  topEtats: { etat: string; stock_g: number }[]
}

export interface ProductionStats {
  annee: number
  nbVarietes: number
  totalCueilli: number
  totalTrie: number
  tempsTotalMin: number
}

export interface DashboardParcelleData {
  site_nom: string
  parcelles: {
    parcelle_nom: string
    parcelle_code: string
    rangs: {
      numero: string
      plantings: { variete: string; date_plantation: string; nb_plants: number | null }[]
      occultation_active: { methode: string; date_debut: string } | null
      est_vide: boolean
    }[]
  }[]
}

export interface DashboardTempsData {
  // Transformation
  cueillette_min: number
  tronconnage_min: number
  sechage_min: number
  triage_min: number
  production_min: number
  // Culture (via production_summary)
  semis_min: number
  repiquage_min: number
  plantation_min: number
  suivi_rang_min: number
  arrachage_min: number
  // Culture (requête directe — pas de variety_id)
  travail_sol_min: number
  occultation_min: number
  // Totaux
  total_min: number
  total_culture_min: number
  total_transformation_min: number
  top_varietes: { nom: string; total_min: number }[]
}

export interface DashboardAvancementData {
  varietes: { nom: string; partie_plante: string | null; cueilli_g: number; prevu_g: number; pct: number }[]
  global_pct: number
}

export interface DashboardActiviteItem {
  type: string
  variete: string
  date: string
  poids_g?: number
  nb_unites?: number
}

/* ─── Widget Stock ─── */

export async function fetchDashboardStock(_farmId?: string): Promise<TopStockRow[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('v_stock')
    .select('variety_id, etat_plante, stock_g')
    .eq('farm_id', farmId)

  if (error || !data || data.length === 0) return []

  const map = new Map<string, { total: number; etats: Map<string, number> }>()
  for (const row of data) {
    let entry = map.get(row.variety_id)
    if (!entry) {
      entry = { total: 0, etats: new Map() }
      map.set(row.variety_id, entry)
    }
    const g = Number(row.stock_g)
    entry.total += g
    entry.etats.set(row.etat_plante, (entry.etats.get(row.etat_plante) ?? 0) + g)
  }

  const ids = Array.from(map.keys())
  const { data: varieties } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire')
    .in('id', ids)

  const nameMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))

  const sorted = Array.from(map.entries())
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)

  return sorted.map(([id, v]) => ({
    variety_id: id,
    nom_vernaculaire: nameMap.get(id) ?? 'Inconnue',
    total_g: v.total,
    topEtats: Array.from(v.etats.entries())
      .filter(([, g]) => g > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([etat, stock_g]) => ({ etat, stock_g })),
  }))
}

/* ─── Widget Production ─── */

export async function fetchDashboardProduction(_farmId: string | undefined, annee: number): Promise<ProductionStats> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('production_summary')
    .select('variety_id, total_cueilli_g, total_triee_g, temps_cueillette_min, temps_tronconnage_min, temps_sechage_min, temps_triage_min, temps_production_min')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .is('mois', null)

  if (error || !data || data.length === 0) {
    return { annee, nbVarietes: 0, totalCueilli: 0, totalTrie: 0, tempsTotalMin: 0 }
  }

  let totalCueilli = 0
  let totalTrie = 0
  let tempsTotalMin = 0

  for (const row of data) {
    totalCueilli += Number(row.total_cueilli_g) || 0
    totalTrie += Number(row.total_triee_g) || 0
    tempsTotalMin += (Number(row.temps_cueillette_min) || 0) +
      (Number(row.temps_tronconnage_min) || 0) +
      (Number(row.temps_sechage_min) || 0) +
      (Number(row.temps_triage_min) || 0) +
      (Number(row.temps_production_min) || 0)
  }

  return { annee, nbVarietes: data.length, totalCueilli, totalTrie, tempsTotalMin }
}

/* ─── Widget Vue Parcelles ─── */

export async function fetchDashboardParcelles(_farmId?: string): Promise<DashboardParcelleData[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  // Récupérer sites → parcelles → rangs
  const { data: sites } = await supabase
    .from('sites')
    .select('id, nom')
    .eq('farm_id', farmId)
    .order('nom')

  if (!sites || sites.length === 0) return []

  const siteIds = sites.map(s => s.id)

  const { data: parcels } = await supabase
    .from('parcels')
    .select('id, site_id, nom, code')
    .in('site_id', siteIds)
    .order('nom')

  if (!parcels || parcels.length === 0) return []

  const parcelIds = parcels.map(p => p.id)

  const { data: rows } = await supabase
    .from('rows')
    .select('id, parcel_id, numero, position_ordre')
    .in('parcel_id', parcelIds)
    .order('position_ordre')

  if (!rows || rows.length === 0) return []

  const rowIds = rows.map(r => r.id)

  // Plantings actifs
  const { data: plantings } = await supabase
    .from('plantings')
    .select('row_id, variety_id, date_plantation, nb_plants, actif')
    .in('row_id', rowIds)
    .eq('actif', true)
    .is('deleted_at', null)

  // Occultations actives (date_fin IS NULL)
  const { data: occultations } = await supabase
    .from('occultations')
    .select('row_id, methode, date_debut')
    .in('row_id', rowIds)
    .is('date_fin', null)

  // Noms des variétés
  const varietyIds = [...new Set((plantings ?? []).map(p => p.variety_id).filter((id): id is string => id != null))]
  let varietyMap = new Map<string, string>()
  if (varietyIds.length > 0) {
    const { data: varieties } = await supabase
      .from('varieties')
      .select('id, nom_vernaculaire')
      .in('id', varietyIds)
    varietyMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))
  }

  // Index plantings par row_id
  const plantingsByRow = new Map<string, { variete: string; date_plantation: string; nb_plants: number | null }[]>()
  for (const p of plantings ?? []) {
    if (!p.row_id || !p.variety_id) continue
    const list = plantingsByRow.get(p.row_id) ?? []
    list.push({
      variete: varietyMap.get(p.variety_id) ?? 'Inconnue',
      date_plantation: p.date_plantation ?? '',
      nb_plants: p.nb_plants,
    })
    plantingsByRow.set(p.row_id, list)
  }

  // Index occultations par row_id
  const occultByRow = new Map<string, { methode: string; date_debut: string }>()
  for (const o of occultations ?? []) {
    occultByRow.set(o.row_id, { methode: o.methode, date_debut: o.date_debut })
  }

  // Index parcels par site_id
  const parcelsBySite = new Map<string, typeof parcels>()
  for (const p of parcels) {
    if (!p.site_id) continue
    const list = parcelsBySite.get(p.site_id) ?? []
    list.push(p)
    parcelsBySite.set(p.site_id, list)
  }

  // Index rows par parcel_id
  const rowsByParcel = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.parcel_id) continue
    const list = rowsByParcel.get(r.parcel_id) ?? []
    list.push(r)
    rowsByParcel.set(r.parcel_id, list)
  }

  // Assemblage
  return sites.map(site => ({
    site_nom: site.nom,
    parcelles: (parcelsBySite.get(site.id) ?? []).map(parcel => ({
      parcelle_nom: parcel.nom,
      parcelle_code: parcel.code,
      rangs: (rowsByParcel.get(parcel.id) ?? []).map(row => {
        const rPlantings = plantingsByRow.get(row.id) ?? []
        const occ = occultByRow.get(row.id) ?? null
        return {
          numero: row.numero,
          plantings: rPlantings,
          occultation_active: occ,
          est_vide: rPlantings.length === 0 && !occ,
        }
      }),
    })),
  }))
}

/* ─── Widget Temps de travail ─── */

export async function fetchDashboardTemps(_farmId: string | undefined, annee: number): Promise<DashboardTempsData> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const startDate = `${annee}-01-01`
  const endDate = `${annee}-12-31`

  // 1. Temps via production_summary (par variété)
  const { data, error } = await supabase
    .from('production_summary')
    .select('variety_id, temps_cueillette_min, temps_tronconnage_min, temps_sechage_min, temps_triage_min, temps_production_min, temps_semis_min, temps_repiquage_min, temps_plantation_min, temps_suivi_rang_min, temps_arrachage_min')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .is('mois', null)

  // 2. Temps travail de sol (pas de variety_id → requête directe)
  const { data: swData } = await supabase
    .from('soil_works')
    .select('temps_min')
    .eq('farm_id', farmId)
    .gte('date', startDate)
    .lte('date', endDate)
    .not('temps_min', 'is', null)

  // 3. Temps occultation (pas de variety_id → requête directe)
  // On prend temps_min (mise en place) + temps_retrait_min (retrait bâche)
  const { data: occData } = await supabase
    .from('occultations')
    .select('temps_min, temps_retrait_min, date_debut')
    .eq('farm_id', farmId)
    .gte('date_debut', startDate)
    .lte('date_debut', endDate)

  const empty: DashboardTempsData = {
    cueillette_min: 0, tronconnage_min: 0, sechage_min: 0, triage_min: 0, production_min: 0,
    semis_min: 0, repiquage_min: 0, plantation_min: 0, suivi_rang_min: 0, arrachage_min: 0,
    travail_sol_min: 0, occultation_min: 0,
    total_min: 0, total_culture_min: 0, total_transformation_min: 0, top_varietes: [],
  }

  // Cumul temps travail de sol
  const travailSol = (swData ?? []).reduce((acc, r) => acc + (Number(r.temps_min) || 0), 0)

  // Cumul temps occultation (mise en place + retrait)
  const occultation = (occData ?? []).reduce((acc, r) =>
    acc + (Number(r.temps_min) || 0) + (Number(r.temps_retrait_min) || 0), 0)

  if (error || !data || data.length === 0) {
    return { ...empty, travail_sol_min: travailSol, occultation_min: occultation,
      total_culture_min: travailSol + occultation,
      total_min: travailSol + occultation }
  }

  let cueillette = 0, tronconnage = 0, sechage = 0, triage = 0, production = 0
  let semis = 0, repiquage = 0, plantation = 0, suiviRang = 0, arrachage = 0

  const tempsParVariete = new Map<string, number>()

  for (const row of data) {
    const c = Number(row.temps_cueillette_min) || 0
    const tr = Number(row.temps_tronconnage_min) || 0
    const s = Number(row.temps_sechage_min) || 0
    const ti = Number(row.temps_triage_min) || 0
    const p = Number(row.temps_production_min) || 0
    const se = Number(row.temps_semis_min) || 0
    const re = Number(row.temps_repiquage_min) || 0
    const pl = Number(row.temps_plantation_min) || 0
    const sr = Number(row.temps_suivi_rang_min) || 0
    const ar = Number(row.temps_arrachage_min) || 0
    cueillette += c
    tronconnage += tr
    sechage += s
    triage += ti
    production += p
    semis += se
    repiquage += re
    plantation += pl
    suiviRang += sr
    arrachage += ar
    tempsParVariete.set(row.variety_id, c + tr + s + ti + p + se + re + pl + sr + ar)
  }

  // Top 5 variétés par temps total
  const topIds = Array.from(tempsParVariete.entries())
    .filter(([, t]) => t > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  let topVarietes: { nom: string; total_min: number }[] = []
  if (topIds.length > 0) {
    const { data: varieties } = await supabase
      .from('varieties')
      .select('id, nom_vernaculaire')
      .in('id', topIds.map(([id]) => id))

    const nameMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))
    topVarietes = topIds.map(([id, total]) => ({
      nom: nameMap.get(id) ?? 'Inconnue',
      total_min: total,
    }))
  }

  const totalCulture = semis + repiquage + plantation + suiviRang + arrachage + travailSol + occultation
  const totalTransformation = cueillette + tronconnage + sechage + triage + production
  const total = totalCulture + totalTransformation

  return {
    cueillette_min: cueillette,
    tronconnage_min: tronconnage,
    sechage_min: sechage,
    triage_min: triage,
    production_min: production,
    semis_min: semis,
    repiquage_min: repiquage,
    plantation_min: plantation,
    suivi_rang_min: suiviRang,
    arrachage_min: arrachage,
    travail_sol_min: travailSol,
    occultation_min: occultation,
    total_min: total,
    total_culture_min: totalCulture,
    total_transformation_min: totalTransformation,
    top_varietes: topVarietes,
  }
}

/* ─── Widget Avancement prévisionnel ─── */

export async function fetchDashboardAvancement(_farmId: string | undefined, annee: number): Promise<DashboardAvancementData> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  const startDate = `${annee}-01-01`
  const endDate = `${annee}-12-31`

  // Forecasts frais pour l'année (avec partie_plante)
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('variety_id, partie_plante, quantite_prevue_g')
    .eq('farm_id', farmId)
    .eq('annee', annee)
    .eq('etat_plante', 'frais')

  if (!forecasts || forecasts.length === 0) {
    return { varietes: [], global_pct: 0 }
  }

  // Harvests de l'année par variété × partie
  const varietyIds = [...new Set(forecasts.map(f => f.variety_id))]
  const { data: harvests } = await supabase
    .from('harvests')
    .select('variety_id, partie_plante, poids_g')
    .eq('farm_id', farmId)
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)
    .in('variety_id', varietyIds)

  // Agréger cueilli par variété × partie
  const cueilliMap = new Map<string, number>()
  for (const h of harvests ?? []) {
    const partie = h.partie_plante ?? 'plante_entiere'
    const key = `${h.variety_id}:${partie}`
    cueilliMap.set(key, (cueilliMap.get(key) ?? 0) + (Number(h.poids_g) || 0))
  }

  // Noms des variétés
  const { data: varieties } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire')
    .in('id', varietyIds)

  const nameMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))

  // Top 10 par objectif décroissant — chaque forecast = variété × partie
  const items = forecasts
    .filter(f => (Number(f.quantite_prevue_g) || 0) > 0)
    .map(f => {
      const prevu = Number(f.quantite_prevue_g) || 0
      const partie = f.partie_plante ?? null
      let cueilli = 0
      if (partie) {
        cueilli = cueilliMap.get(`${f.variety_id}:${partie}`) ?? 0
      } else {
        // Pas de partie → sommer toutes les parties
        for (const [key, val] of cueilliMap) {
          if (key.startsWith(`${f.variety_id}:`)) cueilli += val
        }
      }
      return {
        nom: nameMap.get(f.variety_id) ?? 'Inconnue',
        partie_plante: partie,
        cueilli_g: cueilli,
        prevu_g: prevu,
        pct: prevu > 0 ? Math.round((cueilli / prevu) * 100) : 0,
      }
    })
    .sort((a, b) => b.prevu_g - a.prevu_g)
    .slice(0, 10)

  // Avancement global
  const totalPrevu = items.reduce((s, i) => s + i.prevu_g, 0)
  const totalCueilli = items.reduce((s, i) => s + i.cueilli_g, 0)
  const global_pct = totalPrevu > 0 ? Math.round((totalCueilli / totalPrevu) * 100) : 0

  return { varietes: items, global_pct }
}

/* ─── Widget Activité récente ─── */

export async function fetchDashboardActiviteRecente(_farmId?: string): Promise<DashboardActiviteItem[]> {
  const { farmId } = await getContext()
  const supabase = createAdminClient()

  // Requêtes parallèles sur les 5 tables sources
  const [harvests, cuttings, dryings, sortings, prodLots] = await Promise.all([
    supabase
      .from('harvests')
      .select('variety_id, date, poids_g, created_at')
      .eq('farm_id', farmId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('cuttings')
      .select('variety_id, date, poids_g, type, created_at')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('dryings')
      .select('variety_id, date, poids_g, type, created_at')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('sortings')
      .select('variety_id, date, poids_g, type, created_at')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('production_lots')
      .select('recipe_id, date_production, nb_unites, poids_total_g, created_at')
      .eq('farm_id', farmId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Collecter tous les variety_ids
  const allVarietyIds = new Set<string>()
  for (const row of harvests.data ?? []) allVarietyIds.add(row.variety_id)
  for (const row of cuttings.data ?? []) allVarietyIds.add(row.variety_id)
  for (const row of dryings.data ?? []) allVarietyIds.add(row.variety_id)
  for (const row of sortings.data ?? []) allVarietyIds.add(row.variety_id)

  let varietyMap = new Map<string, string>()
  if (allVarietyIds.size > 0) {
    const { data: varieties } = await supabase
      .from('varieties')
      .select('id, nom_vernaculaire')
      .in('id', Array.from(allVarietyIds))
    varietyMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))
  }

  const items: (DashboardActiviteItem & { _sortDate: string })[] = []

  for (const h of harvests.data ?? []) {
    items.push({
      type: 'Cueillette',
      variete: varietyMap.get(h.variety_id) ?? 'Inconnue',
      date: h.date,
      poids_g: Number(h.poids_g),
      _sortDate: h.created_at,
    })
  }

  for (const c of cuttings.data ?? []) {
    items.push({
      type: c.type === 'entree' ? 'Tronçonnage entrée' : 'Tronçonnage sortie',
      variete: varietyMap.get(c.variety_id) ?? 'Inconnue',
      date: c.date,
      poids_g: Number(c.poids_g),
      _sortDate: c.created_at,
    })
  }

  for (const d of dryings.data ?? []) {
    items.push({
      type: d.type === 'entree' ? 'Séchage entrée' : 'Séchage sortie',
      variete: varietyMap.get(d.variety_id) ?? 'Inconnue',
      date: d.date,
      poids_g: Number(d.poids_g),
      _sortDate: d.created_at,
    })
  }

  for (const s of sortings.data ?? []) {
    items.push({
      type: s.type === 'entree' ? 'Triage entrée' : 'Triage sortie',
      variete: varietyMap.get(s.variety_id) ?? 'Inconnue',
      date: s.date,
      poids_g: Number(s.poids_g),
      _sortDate: s.created_at,
    })
  }

  // Résoudre les noms de recettes
  const recipeIds = [...new Set((prodLots.data ?? []).map(p => p.recipe_id).filter((id): id is string => id != null))]
  let recipeMap = new Map<string, string>()
  if (recipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, nom')
      .in('id', recipeIds)
    recipeMap = new Map((recipes ?? []).map(r => [r.id, r.nom]))
  }

  for (const p of prodLots.data ?? []) {
    const recipeName = (p.recipe_id ? recipeMap.get(p.recipe_id) : null) ?? 'Lot'
    items.push({
      type: 'Production',
      variete: recipeName,
      date: p.date_production,
      nb_unites: p.nb_unites ?? undefined,
      poids_g: p.poids_total_g != null ? Number(p.poids_total_g) : undefined,
      _sortDate: p.created_at,
    })
  }

  // Trier par date de création décroissante, prendre les 10 premiers
  items.sort((a, b) => b._sortDate.localeCompare(a._sortDate))

  return items.slice(0, 10).map(({ _sortDate, ...rest }) => rest)
}

