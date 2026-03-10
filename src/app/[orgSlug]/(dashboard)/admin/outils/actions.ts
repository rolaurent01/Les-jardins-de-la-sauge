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
