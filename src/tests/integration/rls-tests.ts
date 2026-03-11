/**
 * NIVEAU 1 — Tests RLS
 * Vérifie que chaque table est accessible avec les bonnes permissions.
 * Utilise un client authentifié (RLS active) pour tester les permissions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TestResult } from './run-integration-tests'

const TEST_PREFIX = '__TEST__'

/** Tables métier scopées par farm_id */
const METIER_TABLES = [
  'sites', 'parcels', 'rows',
  'seed_lots', 'seedlings',
  'soil_works', 'plantings', 'row_care', 'harvests', 'uprootings', 'occultations',
  'cuttings', 'dryings', 'sortings',
  'stock_movements', 'stock_purchases', 'stock_direct_sales', 'stock_adjustments',
  'recipes', 'production_lots',
  'forecasts',
] as const

export async function runRlsTests(
  authed: SupabaseClient,
  admin: SupabaseClient,
  farmId: string,
): Promise<TestResult[]> {
  const results: TestResult[] = []

  const pass = (name: string) => results.push({ name, passed: true })
  const fail = (name: string, error: string) => results.push({ name, passed: false, error })

  // ─── 1a. Tables catalogue partagé ───

  // SELECT varieties
  {
    const { data, error } = await authed.from('varieties').select('id').limit(5)
    if (error) fail('varieties: SELECT', error.message)
    else if (!data || data.length === 0) fail('varieties: SELECT', 'Aucune variété trouvée')
    else pass('varieties: SELECT')
  }

  // INSERT variety
  {
    const { data, error } = await authed.from('varieties').insert({
      nom_vernaculaire: `${TEST_PREFIX}RLS_Variety`,
      famille: 'Lamiacées',
      type_cycle: 'vivace',
      parties_utilisees: ['feuille'],
      created_by_farm_id: farmId,
    }).select('id').single()
    if (error) fail('varieties: INSERT', error.message)
    else if (!data) fail('varieties: INSERT', 'Pas de données retournées')
    else pass('varieties: INSERT')
  }

  // UPDATE variety (créée par sa ferme)
  {
    const { error } = await authed.from('varieties')
      .update({ notes: `${TEST_PREFIX}updated` })
      .eq('nom_vernaculaire', `${TEST_PREFIX}RLS_Variety`)
    if (error) fail('varieties: UPDATE', error.message)
    else pass('varieties: UPDATE')
  }

  // Soft-delete variety
  {
    const { error } = await authed.from('varieties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('nom_vernaculaire', `${TEST_PREFIX}RLS_Variety`)
    if (error) fail('varieties: SOFT DELETE', error.message)
    else pass('varieties: SOFT DELETE')
  }

  // Nettoyage variété RLS (via admin pour hard delete)
  await admin.from('varieties').delete().eq('nom_vernaculaire', `${TEST_PREFIX}RLS_Variety`)

  // SELECT external_materials
  {
    const { error } = await authed.from('external_materials').select('id').limit(1)
    if (error) fail('external_materials: SELECT', error.message)
    else pass('external_materials: SELECT')
  }

  // SELECT product_categories
  {
    const { data, error } = await authed.from('product_categories').select('id').limit(1)
    if (error) fail('product_categories: SELECT', error.message)
    else if (!data || data.length === 0) fail('product_categories: SELECT', 'Aucune catégorie trouvée')
    else pass('product_categories: SELECT')
  }

  // ─── 1b. Tables métier (scopées farm_id) ───

  for (const table of METIER_TABLES) {
    const { error } = await authed.from(table).select('id').limit(1)
    if (error) {
      // Vérifier si c'est une erreur RLS (pas juste "table vide")
      const msg = error.message.toLowerCase()
      if (msg.includes('permission denied') || msg.includes('infinite recursion') || msg.includes('policy')) {
        fail(`${table}: SELECT`, error.message)
      } else {
        // Erreur non-RLS (ex: table vide) → on considère OK
        fail(`${table}: SELECT`, error.message)
      }
    } else {
      pass(`${table}: SELECT`)
    }
  }

  // ─── 1c. Tables plateforme ───

  // organizations
  {
    const { data, error } = await authed.from('organizations').select('id').limit(1)
    if (error) fail('organizations: SELECT', error.message)
    else if (!data || data.length === 0) fail('organizations: SELECT', 'Aucune organisation visible')
    else pass('organizations: SELECT')
  }

  // farms
  {
    const { data, error } = await authed.from('farms').select('id').limit(1)
    if (error) fail('farms: SELECT', error.message)
    else if (!data || data.length === 0) fail('farms: SELECT', 'Aucune ferme visible')
    else pass('farms: SELECT')
  }

  // memberships
  {
    const { data, error } = await authed.from('memberships').select('id').limit(1)
    if (error) fail('memberships: SELECT', error.message)
    else if (!data || data.length === 0) fail('memberships: SELECT', 'Aucune membership visible')
    else pass('memberships: SELECT')
  }

  // platform_admins (le test critique — récursion infinie corrigée en migration 027)
  {
    const { error } = await authed.from('platform_admins').select('user_id').limit(1)
    if (error) {
      if (error.message.toLowerCase().includes('infinite recursion')) {
        fail('platform_admins: SELECT (RÉCURSION!)', error.message)
      } else {
        fail('platform_admins: SELECT', error.message)
      }
    } else {
      pass('platform_admins: SELECT (pas de récursion)')
    }
  }

  // farm_variety_settings
  {
    const { error } = await authed.from('farm_variety_settings').select('id').limit(1)
    if (error) fail('farm_variety_settings: SELECT', error.message)
    else pass('farm_variety_settings: SELECT')
  }

  // notifications
  {
    const { error } = await authed.from('notifications').select('id').limit(1)
    if (error) fail('notifications: SELECT', error.message)
    else pass('notifications: SELECT')
  }

  // ─── 1d. Tables restreintes ───

  // app_logs (admin seulement)
  {
    const { error } = await authed.from('app_logs').select('id').limit(1)
    if (error && error.message.toLowerCase().includes('infinite recursion')) {
      fail('app_logs: SELECT', error.message)
    } else {
      // Pas d'erreur OU erreur "permission denied" (comportement attendu si pas admin) → OK
      pass('app_logs: SELECT (pas de crash)')
    }
  }

  // audit_log
  {
    const { error } = await authed.from('audit_log').select('id').limit(1)
    if (error && error.message.toLowerCase().includes('infinite recursion')) {
      fail('audit_log: SELECT', error.message)
    } else {
      pass('audit_log: SELECT (pas de crash)')
    }
  }

  // ─── 1e. Vue v_stock ───
  {
    const { error } = await authed.from('v_stock').select('*').limit(1)
    if (error) fail('v_stock: SELECT', error.message)
    else pass('v_stock: SELECT')
  }

  return results
}
