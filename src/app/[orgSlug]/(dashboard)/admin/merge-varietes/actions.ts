'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
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

// ── Types ────────────────────────────────────────────

export type VarietyOption = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  created_by_farm_id: string | null
}

export type MergePreview = {
  details: { table: string; count: number }[]
  total: number
}

export type MergeResult = {
  tables_updated: { table: string; count: number }[]
}

// ── Tables contenant variety_id ──────────────────────

const FK_TABLES = [
  'seed_lots',
  'seedlings',
  'plantings',
  'row_care',
  'harvests',
  'uprootings',
  'cuttings',
  'dryings',
  'sortings',
  'stock_movements',
  'stock_purchases',
  'stock_direct_sales',
  'stock_adjustments',
  'recipe_ingredients',
  'production_lot_ingredients',
  'forecasts',
  'farm_variety_settings',
] as const

// ── fetchAllVarieties ────────────────────────────────

/** Toutes les variétés non supprimées, non fusionnées */
export async function fetchAllVarieties(): Promise<VarietyOption[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin, famille, created_by_farm_id')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('nom_vernaculaire')

  if (error) throw new Error(mapSupabaseError(error))
  return (data ?? []) as VarietyOption[]
}

// ── previewMerge ─────────────────────────────────────

/** Compte le nombre de FK qui seront mises à jour pour chaque table */
export async function previewMerge(
  sourceId: string,
  targetId: string,
): Promise<MergePreview> {
  await requireAdmin()
  if (sourceId === targetId) throw new Error('Source et cible identiques')

  const admin = createAdminClient()

  // Paralléliser les comptages sur toutes les tables FK
  const results = await Promise.all(
    FK_TABLES.map(async (table) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (admin as any)
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('variety_id', sourceId)

      if (error) throw new Error(mapSupabaseError(error))
      return { table, count: count ?? 0 }
    })
  )

  const details = results.filter(d => d.count > 0)
  const total = details.reduce((sum, d) => sum + d.count, 0)
  return { details, total }
}

// ── executeMerge ─────────────────────────────────────

/** Fusionne la source vers la cible : met à jour toutes les FK puis soft-delete la source */
export async function executeMerge(
  sourceId: string,
  targetId: string,
): Promise<ActionResult<MergeResult>> {
  const userId = await requireAdmin()
  if (sourceId === targetId) return { error: 'Source et cible identiques.' }

  const admin = createAdminClient()

  // Charger la source pour les infos
  const { data: source, error: srcErr } = await admin
    .from('varieties')
    .select('*')
    .eq('id', sourceId)
    .single()

  if (srcErr || !source) return { error: 'Variété source introuvable.' }

  // Charger la cible pour les aliases
  const { data: target, error: tgtErr } = await admin
    .from('varieties')
    .select('aliases')
    .eq('id', targetId)
    .single()

  if (tgtErr || !target) return { error: 'Variété cible introuvable.' }

  // Tables avec contrainte UNIQUE sur (farm_id, variety_id) ou similaire
  const UNIQUE_TABLES = ['farm_variety_settings', 'forecasts'] as const

  // Paralléliser les updates sur les tables sans contrainte UNIQUE
  const normalTables = FK_TABLES.filter(
    t => !UNIQUE_TABLES.includes(t as typeof UNIQUE_TABLES[number])
  )
  const normalResults = await Promise.all(
    normalTables.map(async (table) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin as any)
        .from(table)
        .update({ variety_id: targetId })
        .eq('variety_id', sourceId)
        .select('id')

      if (error) throw new Error(mapSupabaseError(error))
      return { table, count: data?.length ?? 0 }
    })
  )

  // Tables UNIQUE : gestion séquentielle (conflits possibles)
  const uniqueResults = await Promise.all(
    UNIQUE_TABLES.map(async (table) => {
      const updated = await handleUniqueTable(admin, table, sourceId, targetId)
      return { table, count: updated }
    })
  )

  const tablesUpdated = [...normalResults, ...uniqueResults].filter(d => d.count > 0)

  // Fusionner les aliases : cible.aliases + source.aliases + source.nom_vernaculaire
  const currentAliases = target.aliases ?? []
  const sourceAliases = (source as { aliases: string[] | null }).aliases ?? []
  const mergedAliases = [
    ...new Set([
      ...currentAliases,
      ...sourceAliases,
      source.nom_vernaculaire,
    ]),
  ]

  // Soft-delete la source avec merged_into_id
  const { error: mergeErr } = await admin
    .from('varieties')
    .update({
      merged_into_id: targetId,
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', sourceId)

  if (mergeErr) return { error: mapSupabaseError(mergeErr) }

  // Mettre à jour les aliases de la cible
  const { error: aliasErr } = await admin
    .from('varieties')
    .update({ aliases: mergedAliases, updated_by: userId })
    .eq('id', targetId)

  if (aliasErr) return { error: mapSupabaseError(aliasErr) }

  // Log dans audit_log
  await admin.from('audit_log').insert({
    user_id: userId,
    action: 'merge',
    table_name: 'varieties',
    record_id: sourceId,
    old_data: { source_id: sourceId, nom: source.nom_vernaculaire },
    new_data: { target_id: targetId, tables_updated: tablesUpdated },
  })

  return { success: true, data: { tables_updated: tablesUpdated } }
}

// ── Helper : gestion des tables avec UNIQUE ──────────

async function handleUniqueTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
  sourceId: string,
  targetId: string,
): Promise<number> {
  // Récupérer les lignes de la source
  const { data: sourceRows, error: srcErr } = await admin
    .from(table)
    .select('*')
    .eq('variety_id', sourceId)

  if (srcErr || !sourceRows || sourceRows.length === 0) return 0

  // Récupérer les lignes de la cible pour détecter les conflits
  const { data: targetRows } = await admin
    .from(table)
    .select('*')
    .eq('variety_id', targetId)

  let updated = 0

  for (const row of sourceRows) {
    // Vérifier s'il y a un conflit UNIQUE
    let hasConflict = false

    if (table === 'farm_variety_settings' && targetRows) {
      hasConflict = targetRows.some(
        (t: { farm_id: string }) => t.farm_id === row.farm_id,
      )
    } else if (table === 'forecasts' && targetRows) {
      hasConflict = targetRows.some(
        (t: { farm_id: string; annee: number; etat_plante: string; partie_plante: string }) =>
          t.farm_id === row.farm_id &&
          t.annee === row.annee &&
          t.etat_plante === row.etat_plante &&
          t.partie_plante === row.partie_plante,
      )
    }

    if (hasConflict) {
      // Supprimer la ligne source (le setting cible existe déjà)
      await admin.from(table).delete().eq('id', row.id)
    } else {
      // Mettre à jour vers la cible
      await admin.from(table).update({ variety_id: targetId }).eq('id', row.id)
    }
    updated++
  }

  return updated
}
