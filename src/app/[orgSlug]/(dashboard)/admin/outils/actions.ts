'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

/** Vérifie que l'utilisateur courant est super admin */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

// ── Recalcul production_summary ──────────────────────

/** Appelle la fonction SQL recalculate_production_summary() */
export async function recalculateProductionSummary(): Promise<ActionResult<{ message: string }>> {
  await requireAdmin()
  const admin = createAdminClient()

  const start = Date.now()
  // La fonction SQL existe mais n'est pas dans les types générés Supabase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.rpc as any)('recalculate_production_summary')
  const duration = Date.now() - start

  if (error) return { error: mapSupabaseError(error) }

  return {
    success: true,
    data: { message: `Recalcul terminé en ${duration}ms.` },
  }
}

// ── Statut des backups ──────────────────────────────

/** Entrée de log backup */
export type BackupLogEntry = {
  id: string
  level: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/** Récupère les 5 derniers logs de backup */
export async function getBackupStatus(): Promise<BackupLogEntry[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('app_logs')
    .select('id, level, message, metadata, created_at')
    .eq('source', 'backup')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw new Error(mapSupabaseError(error))
  return (data ?? []) as BackupLogEntry[]
}

// ── Impersonation ───────────────────────────────────

/** Organisation avec ses fermes pour le select d'impersonation */
export type OrgWithFarms = {
  id: string
  nom: string
  slug: string
  farms: { id: string; nom: string }[]
}

/** Récupère toutes les organisations avec leurs fermes */
export async function fetchOrgsWithFarms(): Promise<OrgWithFarms[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('organizations')
    .select('id, nom, slug, farms(id, nom)')
    .order('nom')

  if (error) throw new Error(mapSupabaseError(error))
  return (data ?? []) as OrgWithFarms[]
}

/** Active l'impersonation pour une ferme */
export async function impersonateFarm(farmId: string): Promise<ActionResult<{ orgSlug: string }>> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier que la ferme existe
  const { data: farm, error } = await admin
    .from('farms')
    .select('id, organization_id, organizations(slug)')
    .eq('id', farmId)
    .single()

  if (error || !farm) return { error: 'Ferme introuvable.' }

  const orgSlug = (farm.organizations as { slug: string } | null)?.slug
  if (!orgSlug) return { error: 'Organisation introuvable.' }

  // Set le cookie d'impersonation
  const cookieStore = await cookies()
  cookieStore.set('impersonate_farm_id', farmId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24h max
  })

  revalidatePath('/', 'layout')
  return { success: true, data: { orgSlug } }
}

/** Arrête l'impersonation */
export async function stopImpersonation(): Promise<ActionResult> {
  await requireAdmin()

  const cookieStore = await cookies()
  cookieStore.delete('impersonate_farm_id')

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Récupère le farm_id d'impersonation actif (pour affichage) */
export async function getImpersonationStatus(): Promise<{ farmId: string; farmName: string } | null> {
  await requireAdmin()
  const cookieStore = await cookies()
  const farmId = cookieStore.get('impersonate_farm_id')?.value

  if (!farmId) return null

  const admin = createAdminClient()
  const { data: farm } = await admin
    .from('farms')
    .select('id, nom')
    .eq('id', farmId)
    .single()

  if (!farm) return null
  return { farmId: farm.id, farmName: farm.nom }
}

// ── Clôture de saison ───────────────────────────────

/** Planting actif avec ses relations pour la clôture */
export type ActivePlanting = {
  id: string
  variety_id: string
  variety_name: string
  type_cycle: string | null
  date_plantation: string
  row_numero: string
  parcel_nom: string
  row_id: string
}

/** Ferme pour le select de clôture */
export type FarmOption = {
  id: string
  nom: string
}

/** Récupère les fermes disponibles */
export async function fetchFarms(): Promise<FarmOption[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('farms')
    .select('id, nom')
    .order('nom')

  if (error) throw new Error(mapSupabaseError(error))
  return (data ?? []) as FarmOption[]
}

/** Récupère les plantings actifs d'une ferme pour une année */
export async function fetchActivePlantings(farmId: string, year: number): Promise<ActivePlanting[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('plantings')
    .select(`
      id,
      variety_id,
      date_plantation,
      row_id,
      varieties(nom_vernaculaire, type_cycle),
      rows(numero, parcels(nom))
    `)
    .eq('farm_id', farmId)
    .eq('actif', true)
    .eq('annee', year)
    .is('deleted_at', null)
    .order('date_plantation')

  if (error) throw new Error(mapSupabaseError(error))
  if (!data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((p: any) => ({
    id: p.id,
    variety_id: p.variety_id ?? '',
    variety_name: p.varieties?.nom_vernaculaire ?? 'Inconnue',
    type_cycle: p.varieties?.type_cycle ?? null,
    date_plantation: p.date_plantation,
    row_numero: p.rows?.numero ?? '?',
    parcel_nom: p.rows?.parcels?.nom ?? '?',
    row_id: p.row_id ?? '',
  }))
}

/** Arrache un planting (clôture) : actif = false + crée un arrachage au 31/12 */
export async function closeSeasonForPlanting(
  plantingId: string,
  action: 'keep' | 'uproot',
  year: number,
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  if (action === 'keep') {
    return { success: true }
  }

  // Récupérer le planting
  const { data: planting, error: fetchErr } = await admin
    .from('plantings')
    .select('id, row_id, variety_id, farm_id')
    .eq('id', plantingId)
    .single()

  if (fetchErr || !planting) return { error: 'Planting introuvable.' }

  // Passer actif = false
  const { error: updateErr } = await admin
    .from('plantings')
    .update({ actif: false })
    .eq('id', plantingId)

  if (updateErr) return { error: mapSupabaseError(updateErr) }

  // Créer l'arrachage au 31/12
  if (!planting.row_id) return { error: 'Planting sans rang associé.' }

  const { error: insertErr } = await admin
    .from('uprootings')
    .insert({
      farm_id: planting.farm_id,
      row_id: planting.row_id,
      variety_id: planting.variety_id,
      date: `${year}-12-31`,
      commentaire: `Clôture de saison ${year} (admin)`,
    })

  if (insertErr) return { error: mapSupabaseError(insertErr) }

  return { success: true }
}

/** Arrache automatiquement toutes les annuelles actives d'une ferme pour une année */
export async function autoCloseAnnuals(
  farmId: string,
  year: number,
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin()
  const admin = createAdminClient()

  // Récupérer les plantings actifs dont la variété est annuelle
  const { data: plantings, error: fetchErr } = await admin
    .from('plantings')
    .select('id, row_id, variety_id, farm_id, varieties(type_cycle)')
    .eq('farm_id', farmId)
    .eq('actif', true)
    .eq('annee', year)
    .is('deleted_at', null)

  if (fetchErr) return { error: mapSupabaseError(fetchErr) }
  if (!plantings) return { success: true, data: { count: 0 } }

  type PlantingWithCycle = { id: string; row_id: string | null; variety_id: string; farm_id: string; varieties: { type_cycle: string | null } | null }
  // Cast nécessaire : les types Supabase générés ne reconnaissent pas la relation plantings→varieties
  const annuals = (plantings as unknown as PlantingWithCycle[]).filter(
    p => p.varieties?.type_cycle === 'annuelle'
  )

  if (annuals.length === 0) return { success: true, data: { count: 0 } }

  // Filtrer ceux qui ont un row_id valide
  const toUproot = annuals.filter(p => p.row_id != null)
  const ids = toUproot.map(p => p.id)

  // Batch update : passer actif = false
  const { error: updateErr } = await admin
    .from('plantings')
    .update({ actif: false })
    .in('id', ids)

  if (updateErr) return { error: mapSupabaseError(updateErr) }

  // Batch insert : créer les arrachages au 31/12
  const uprootingRows = toUproot.map(p => ({
    farm_id: p.farm_id,
    row_id: p.row_id!,
    variety_id: p.variety_id,
    date: `${year}-12-31`,
    commentaire: `Clôture de saison ${year} (admin)`,
  }))

  const { error: insertErr } = await admin
    .from('uprootings')
    .insert(uprootingRows)

  if (insertErr) return { error: mapSupabaseError(insertErr) }

  return { success: true, data: { count: toUproot.length } }
}

// ── Super data cross-tenant ─────────────────────────

export type SuperDataResult = {
  stockParEtat: { etat: string; total_kg: number }[]
  activiteParOrg: { org_nom: string; nb_cueillettes: number; nb_lots: number; nb_users: number }[]
  topVarietes: { nom_vernaculaire: string; nb_fermes: number }[]
  volumeParMois: { mois: number; total_kg: number }[]
}

/** Agrégations cross-tenant via admin client (bypass RLS) */
export async function fetchSuperData(): Promise<SuperDataResult> {
  await requireAdmin()
  const admin = createAdminClient()

  // 1. Stock total par état
  const { data: stockData, error: stockErr } = await admin
    .from('v_stock')
    .select('etat_plante, stock_g')

  if (stockErr) throw new Error(`Erreur chargement stock : ${stockErr.message}`)

  const stockByEtat = new Map<string, number>()
  for (const row of stockData ?? []) {
    const current = stockByEtat.get(row.etat_plante ?? '') ?? 0
    stockByEtat.set(row.etat_plante ?? '', current + (row.stock_g ?? 0))
  }
  const stockParEtat = Array.from(stockByEtat.entries()).map(([etat, g]) => ({
    etat,
    total_kg: Math.round(g / 10) / 100, // g → kg, 2 décimales
  }))

  // 2. Activité par organisation (mois en cours)
  const now = new Date()
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endOfMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

  const { data: orgs, error: orgsErr } = await admin
    .from('organizations')
    .select('id, nom, farms(id)')

  if (orgsErr) throw new Error(`Erreur chargement organisations : ${orgsErr.message}`)

  // Paralléliser les requêtes par organisation
  const activiteParOrg = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const farmIds = ((org.farms as { id: string }[]) ?? []).map(f => f.id)
      if (farmIds.length === 0) {
        return { org_nom: org.nom, nb_cueillettes: 0, nb_lots: 0, nb_users: 0 }
      }

      const [harvestRes, lotsRes, membersRes] = await Promise.all([
        admin
          .from('harvests')
          .select('id', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .is('deleted_at', null),
        admin
          .from('production_lots')
          .select('id', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date_production', startOfMonth)
          .lt('date_production', endOfMonth)
          .is('deleted_at', null),
        admin
          .from('memberships')
          .select('user_id')
          .eq('organization_id', org.id),
      ])

      return {
        org_nom: org.nom,
        nb_cueillettes: harvestRes.count ?? 0,
        nb_lots: lotsRes.count ?? 0,
        nb_users: (membersRes.data ?? []).length,
      }
    })
  )

  // 3. Top 10 variétés les plus cultivées (plantings actifs)
  const { data: plantingsData, error: plantingsErr } = await admin
    .from('plantings')
    .select('variety_id, farm_id')
    .eq('actif', true)
    .is('deleted_at', null)

  if (plantingsErr) throw new Error(`Erreur chargement plantations : ${plantingsErr.message}`)

  const varietyFarms = new Map<string, Set<string>>()
  for (const p of plantingsData ?? []) {
    if (!p.variety_id) continue
    if (!varietyFarms.has(p.variety_id)) varietyFarms.set(p.variety_id, new Set())
    varietyFarms.get(p.variety_id)!.add(p.farm_id)
  }

  const topVarietyIds = Array.from(varietyFarms.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)

  // Récupérer les noms en une seule requête batch
  const topVids = topVarietyIds.map(([vid]) => vid)
  const { data: varietyNames } = topVids.length > 0
    ? await admin.from('varieties').select('id, nom_vernaculaire').in('id', topVids)
    : { data: [] }

  const nameMap = new Map((varietyNames ?? []).map((v: { id: string; nom_vernaculaire: string }) => [v.id, v.nom_vernaculaire]))
  const topVarietes = topVarietyIds.map(([vid, farms]) => ({
    nom_vernaculaire: nameMap.get(vid) ?? 'Inconnue',
    nb_fermes: farms.size,
  }))

  // 4. Volume total par mois (année en cours)
  const currentYear = now.getFullYear()
  const { data: summaryData, error: summaryErr } = await admin
    .from('production_summary')
    .select('mois, total_cueilli_g')
    .eq('annee', currentYear)

  if (summaryErr) throw new Error(`Erreur chargement production : ${summaryErr.message}`)

  const volumeByMois = new Map<number, number>()
  for (const row of summaryData ?? []) {
    if (row.mois == null) continue
    const current = volumeByMois.get(row.mois) ?? 0
    volumeByMois.set(row.mois, current + (row.total_cueilli_g ?? 0))
  }
  const volumeParMois = Array.from(volumeByMois.entries())
    .map(([mois, g]) => ({ mois, total_kg: Math.round(g / 10) / 100 }))
    .sort((a, b) => a.mois - b.mois)

  return { stockParEtat, activiteParOrg, topVarietes, volumeParMois }
}

// ── Purge archives ──────────────────────────────────

export type ArchivedCount = {
  table: string
  label: string
  count: number
}

const SOFT_DELETE_TABLES: { table: string; label: string }[] = [
  { table: 'varieties', label: 'Variétés' },
  { table: 'seed_lots', label: 'Sachets de graines' },
  { table: 'seedlings', label: 'Semis' },
  { table: 'plantings', label: 'Plantations' },
  { table: 'harvests', label: 'Cueillettes' },
  { table: 'recipes', label: 'Recettes' },
  { table: 'production_lots', label: 'Lots de production' },
  { table: 'stock_movements', label: 'Mouvements de stock' },
]

/** Compte les enregistrements archivés (deleted_at IS NOT NULL) par table */
export async function fetchArchivedCounts(farmId?: string, olderThanDays?: number): Promise<ArchivedCount[]> {
  await requireAdmin()
  const admin = createAdminClient()

  // Paralléliser les comptages sur toutes les tables
  const results = await Promise.all(
    SOFT_DELETE_TABLES.map(async ({ table, label }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (admin as any).from(table).select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)
      if (farmId) query = query.eq('farm_id', farmId)
      if (olderThanDays) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - olderThanDays)
        query = query.lt('deleted_at', cutoff.toISOString())
      }

      const { count, error } = await query
      if (error) throw new Error(mapSupabaseError(error))
      return { table, label, count: count ?? 0 }
    })
  )

  return results
}

/** Hard delete des enregistrements archivés d'une table */
export async function purgeArchives(
  table: string,
  farmId?: string,
  olderThanDays?: number,
): Promise<ActionResult<{ deleted: number; table: string }>> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier que la table est autorisée
  if (!SOFT_DELETE_TABLES.some(t => t.table === table)) {
    return { error: `Table non autorisée : ${table}` }
  }

  // Gérer les dépendances avant suppression
  const depCount = await deleteDependencies(admin, table, farmId, olderThanDays)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any).from(table).delete().not('deleted_at', 'is', null)

  if (farmId) query = query.eq('farm_id', farmId)
  if (olderThanDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)
    query = query.lt('deleted_at', cutoff.toISOString())
  }

  const { data, error } = await query.select('id')
  if (error) return { error: mapSupabaseError(error) }

  return { success: true, data: { deleted: (data?.length ?? 0) + depCount, table } }
}

/** Purge toutes les tables dans le bon ordre (enfants avant parents) */
export async function purgeAllArchives(
  farmId?: string,
  olderThanDays?: number,
): Promise<ActionResult<{ results: { table: string; deleted: number }[]; total: number }>> {
  await requireAdmin()

  // Ordre : enfants avant parents
  const purgeOrder = [
    'stock_movements',
    'production_lots',
    'harvests',
    'seedlings',
    'seed_lots',
    'plantings',
    'recipes',
    'varieties',
  ]

  const results: { table: string; deleted: number }[] = []
  let total = 0

  for (const table of purgeOrder) {
    const res = await purgeArchives(table, farmId, olderThanDays)
    if ('error' in res) return { error: res.error }
    if (res.data && res.data.deleted > 0) {
      results.push({ table, deleted: res.data.deleted })
      total += res.data.deleted
    }
  }

  return { success: true, data: { results, total } }
}

/** Supprime les dépendances FK avant le hard delete d'une table parente */
async function deleteDependencies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  farmId?: string,
  olderThanDays?: number,
): Promise<number> {
  let count = 0

  if (table === 'harvests') {
    // Supprimer les stock_movements associés aux harvests archivés
    const archivedIds = await getArchivedIds(admin, 'harvests', farmId, olderThanDays)
    if (archivedIds.length > 0) {
      const { data } = await admin
        .from('stock_movements')
        .delete()
        .eq('source_type', 'cueillette')
        .in('source_id', archivedIds)
        .select('id')
      count += data?.length ?? 0
    }
  }

  if (table === 'production_lots') {
    // Supprimer les dépendances des lots de production archivés
    const archivedIds = await getArchivedIds(admin, 'production_lots', farmId, olderThanDays)
    if (archivedIds.length > 0) {
      const { data: ingr } = await admin
        .from('production_lot_ingredients')
        .delete()
        .in('production_lot_id', archivedIds)
        .select('id')
      count += ingr?.length ?? 0

      const { data: psm } = await admin
        .from('product_stock_movements')
        .delete()
        .in('production_lot_id', archivedIds)
        .select('id')
      count += psm?.length ?? 0

      const { data: sm } = await admin
        .from('stock_movements')
        .delete()
        .eq('source_type', 'production')
        .in('source_id', archivedIds)
        .select('id')
      count += sm?.length ?? 0
    }
  }

  if (table === 'varieties') {
    // Vérifier qu'aucune FK active ne pointe dessus (batch par table avec .in())
    const archivedIds = await getArchivedIds(admin, 'varieties', farmId, olderThanDays)
    if (archivedIds.length > 0) {
      const fkTables = ['seed_lots', 'seedlings', 'plantings', 'harvests', 'stock_movements']
      const fkChecks = await Promise.all(
        fkTables.map(async (fkTable) => {
          const { data: activeRefs } = await admin
            .from(fkTable)
            .select('variety_id', { count: 'exact', head: false })
            .in('variety_id', archivedIds)
            .is('deleted_at', null)
            .limit(1)

          return { fkTable, activeRef: activeRefs?.[0] ?? null }
        })
      )

      for (const { fkTable, activeRef } of fkChecks) {
        if (activeRef) {
          throw new Error(
            `Impossible de purger : la variété ${activeRef.variety_id} a encore des enregistrement(s) actif(s) dans ${fkTable}.`,
          )
        }
      }
    }
  }

  return count
}

/** Récupère les IDs des enregistrements archivés */
async function getArchivedIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  farmId?: string,
  olderThanDays?: number,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = admin.from(table).select('id').not('deleted_at', 'is', null)
  if (farmId) query = query.eq('farm_id', farmId)
  if (olderThanDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)
    query = query.lt('deleted_at', cutoff.toISOString())
  }
  const { data } = await query
  return (data ?? []).map((r: { id: string }) => r.id)
}
