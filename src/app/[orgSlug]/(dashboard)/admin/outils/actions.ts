'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

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

  if (error) return { error: `Erreur : ${error.message}` }

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

  if (error) throw new Error(`Erreur : ${error.message}`)
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

  if (error) throw new Error(`Erreur : ${error.message}`)
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

  if (error) throw new Error(`Erreur : ${error.message}`)
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

  if (error) throw new Error(`Erreur : ${error.message}`)
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

  if (updateErr) return { error: `Erreur : ${updateErr.message}` }

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

  if (insertErr) return { error: `Erreur arrachage : ${insertErr.message}` }

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

  if (fetchErr) return { error: `Erreur : ${fetchErr.message}` }
  if (!plantings) return { success: true, data: { count: 0 } }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annuals = (plantings as any[]).filter(
    (p: any) => p.varieties?.type_cycle === 'annuelle'
  )

  let count = 0
  for (const p of annuals) {
    const result = await closeSeasonForPlanting(p.id, 'uproot', year)
    if ('success' in result) count++
  }

  return { success: true, data: { count } }
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
  const { data: stockData } = await admin
    .from('v_stock')
    .select('etat_plante, stock_g')

  const stockByEtat = new Map<string, number>()
  for (const row of stockData ?? []) {
    const current = stockByEtat.get(row.etat_plante) ?? 0
    stockByEtat.set(row.etat_plante, current + (row.stock_g ?? 0))
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

  const { data: orgs } = await admin
    .from('organizations')
    .select('id, nom, farms(id)')

  const activiteParOrg: SuperDataResult['activiteParOrg'] = []

  for (const org of orgs ?? []) {
    const farmIds = ((org.farms as { id: string }[]) ?? []).map(f => f.id)
    if (farmIds.length === 0) {
      activiteParOrg.push({ org_nom: org.nom, nb_cueillettes: 0, nb_lots: 0, nb_users: 0 })
      continue
    }

    const { count: nbCueillettes } = await admin
      .from('harvests')
      .select('id', { count: 'exact', head: true })
      .in('farm_id', farmIds)
      .gte('date_cueillette', startOfMonth)
      .lt('date_cueillette', endOfMonth)
      .is('deleted_at', null)

    const { count: nbLots } = await admin
      .from('production_lots')
      .select('id', { count: 'exact', head: true })
      .in('farm_id', farmIds)
      .gte('date_production', startOfMonth)
      .lt('date_production', endOfMonth)
      .is('deleted_at', null)

    const { data: members } = await admin
      .from('memberships')
      .select('user_id')
      .eq('organization_id', org.id)

    activiteParOrg.push({
      org_nom: org.nom,
      nb_cueillettes: nbCueillettes ?? 0,
      nb_lots: nbLots ?? 0,
      nb_users: (members ?? []).length,
    })
  }

  // 3. Top 10 variétés les plus cultivées (plantings actifs)
  const { data: plantingsData } = await admin
    .from('plantings')
    .select('variety_id, farm_id')
    .eq('actif', true)
    .is('deleted_at', null)

  const varietyFarms = new Map<string, Set<string>>()
  for (const p of plantingsData ?? []) {
    if (!p.variety_id) continue
    if (!varietyFarms.has(p.variety_id)) varietyFarms.set(p.variety_id, new Set())
    varietyFarms.get(p.variety_id)!.add(p.farm_id)
  }

  const topVarietyIds = Array.from(varietyFarms.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)

  const topVarietes: SuperDataResult['topVarietes'] = []
  for (const [vid, farms] of topVarietyIds) {
    const { data: v } = await admin
      .from('varieties')
      .select('nom_vernaculaire')
      .eq('id', vid)
      .single()

    topVarietes.push({
      nom_vernaculaire: v?.nom_vernaculaire ?? 'Inconnue',
      nb_fermes: farms.size,
    })
  }

  // 4. Volume total par mois (année en cours)
  const currentYear = now.getFullYear()
  const { data: summaryData } = await admin
    .from('production_summary')
    .select('mois, total_cueilli_g')
    .eq('annee', currentYear)

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
export async function fetchArchivedCounts(farmId?: string): Promise<ArchivedCount[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const results: ArchivedCount[] = []

  for (const { table, label } of SOFT_DELETE_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any).from(table).select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)
    if (farmId) query = query.eq('farm_id', farmId)

    const { count, error } = await query
    if (error) throw new Error(`Erreur sur ${table} : ${error.message}`)
    results.push({ table, label, count: count ?? 0 })
  }

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
  if (error) return { error: `Erreur : ${error.message}` }

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
    // Vérifier qu'aucune FK active ne pointe dessus
    const archivedIds = await getArchivedIds(admin, 'varieties', farmId, olderThanDays)
    const fkTables = ['seed_lots', 'seedlings', 'plantings', 'harvests', 'stock_movements']
    for (const vid of archivedIds) {
      for (const fkTable of fkTables) {
        const { count: fkCount } = await admin
          .from(fkTable)
          .select('id', { count: 'exact', head: true })
          .eq('variety_id', vid)
          .is('deleted_at', null)

        if (fkCount && fkCount > 0) {
          throw new Error(
            `Impossible de purger : la variété ${vid} a encore ${fkCount} enregistrement(s) actif(s) dans ${fkTable}.`,
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
