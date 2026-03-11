/**
 * Nettoyage des données de test (__TEST__).
 * Supprime dans l'ordre inverse des FK (enfants avant parents).
 * Utilise le admin client (service_role, bypass RLS).
 * Ignore les erreurs de suppression (la donnée n'existe peut-être pas).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const TEST_PREFIX = '__TEST__'

/** Supprime toutes les données de test identifiées par le préfixe __TEST__ */
export async function cleanupTestData(admin: SupabaseClient): Promise<void> {
  const log = (table: string, count: number) => {
    if (count > 0) process.stdout.write(`  🧹 ${table}: ${count} lignes supprimées\n`)
  }

  // Récupérer les IDs des variétés test pour cascade
  const { data: testVarieties } = await admin
    .from('varieties')
    .select('id')
    .like('nom_vernaculaire', `${TEST_PREFIX}%`)
  const testVarietyIds = (testVarieties ?? []).map((v: { id: string }) => v.id)

  // Récupérer les IDs des recettes test
  const { data: testRecipes } = await admin
    .from('recipes')
    .select('id')
    .like('nom', `${TEST_PREFIX}%`)
  const testRecipeIds = (testRecipes ?? []).map((r: { id: string }) => r.id)

  // Récupérer les IDs des production_lots test
  const { data: testLots } = await admin
    .from('production_lots')
    .select('id')
    .like('commentaire', `${TEST_PREFIX}%`)
  const testLotIds = (testLots ?? []).map((l: { id: string }) => l.id)

  // Récupérer les IDs des sites test
  const { data: testSites } = await admin
    .from('sites')
    .select('id')
    .like('nom', `${TEST_PREFIX}%`)
  const testSiteIds = (testSites ?? []).map((s: { id: string }) => s.id)

  // Récupérer les IDs des parcelles test
  const { data: testParcels } = await admin
    .from('parcels')
    .select('id')
    .like('code', `${TEST_PREFIX}%`)
  const testParcelIds = (testParcels ?? []).map((p: { id: string }) => p.id)

  // Récupérer les IDs des rangs test
  const { data: testRows } = await admin
    .from('rows')
    .select('id')
    .in('parcel_id', testParcelIds.length > 0 ? testParcelIds : ['00000000-0000-0000-0000-000000000000'])
  const testRowIds = (testRows ?? []).map((r: { id: string }) => r.id)

  // 1. production_lot_ingredients (via production_lots test)
  if (testLotIds.length > 0) {
    const { count } = await admin
      .from('production_lot_ingredients')
      .delete({ count: 'exact' })
      .in('production_lot_id', testLotIds)
    log('production_lot_ingredients', count ?? 0)
  }

  // 2. recipe_ingredients (via recipes test)
  if (testRecipeIds.length > 0) {
    const { count } = await admin
      .from('recipe_ingredients')
      .delete({ count: 'exact' })
      .in('recipe_id', testRecipeIds)
    log('recipe_ingredients', count ?? 0)
  }

  // 3. product_stock_movements (via production_lots test)
  if (testLotIds.length > 0) {
    const { count } = await admin
      .from('product_stock_movements')
      .delete({ count: 'exact' })
      .in('production_lot_id', testLotIds)
    log('product_stock_movements', count ?? 0)
  }

  // 4. stock_movements liés aux variétés test
  if (testVarietyIds.length > 0) {
    const { count } = await admin
      .from('stock_movements')
      .delete({ count: 'exact' })
      .in('variety_id', testVarietyIds)
    log('stock_movements', count ?? 0)
  }

  // 5. production_lots test
  if (testLotIds.length > 0) {
    const { count } = await admin
      .from('production_lots')
      .delete({ count: 'exact' })
      .in('id', testLotIds)
    log('production_lots', count ?? 0)
  }

  // 6. recipes test
  if (testRecipeIds.length > 0) {
    const { count } = await admin
      .from('recipes')
      .delete({ count: 'exact' })
      .in('id', testRecipeIds)
    log('recipes', count ?? 0)
  }

  // 7. harvests, cuttings, dryings, sortings
  for (const table of ['harvests', 'cuttings', 'dryings', 'sortings'] as const) {
    const { count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log(table, count ?? 0)
  }

  // 8. stock_purchases, stock_direct_sales, stock_adjustments
  for (const table of ['stock_purchases', 'stock_direct_sales', 'stock_adjustments'] as const) {
    const { count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log(table, count ?? 0)
  }

  // 9. uprootings, occultations
  for (const table of ['uprootings', 'occultations'] as const) {
    const { count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log(table, count ?? 0)
  }

  // 10. row_care, soil_works
  for (const table of ['row_care', 'soil_works'] as const) {
    const { count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log(table, count ?? 0)
  }

  // 11. plantings
  {
    const { count } = await admin
      .from('plantings')
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log('plantings', count ?? 0)
  }

  // 12. seedlings
  {
    const { count } = await admin
      .from('seedlings')
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log('seedlings', count ?? 0)
  }

  // 13. seed_lots
  {
    const { count } = await admin
      .from('seed_lots')
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log('seed_lots', count ?? 0)
  }

  // 14. rows (dans les parcelles test)
  if (testRowIds.length > 0) {
    const { count } = await admin
      .from('rows')
      .delete({ count: 'exact' })
      .in('id', testRowIds)
    log('rows', count ?? 0)
  }

  // 15. parcels
  if (testParcelIds.length > 0) {
    const { count } = await admin
      .from('parcels')
      .delete({ count: 'exact' })
      .in('id', testParcelIds)
    log('parcels', count ?? 0)
  }

  // 16. sites
  if (testSiteIds.length > 0) {
    const { count } = await admin
      .from('sites')
      .delete({ count: 'exact' })
      .in('id', testSiteIds)
    log('sites', count ?? 0)
  }

  // 17. forecasts
  {
    const { count } = await admin
      .from('forecasts')
      .delete({ count: 'exact' })
      .like('commentaire', `${TEST_PREFIX}%`)
    log('forecasts', count ?? 0)
  }

  // 18. farm_variety_settings liées aux variétés test
  if (testVarietyIds.length > 0) {
    const { count } = await admin
      .from('farm_variety_settings')
      .delete({ count: 'exact' })
      .in('variety_id', testVarietyIds)
    log('farm_variety_settings', count ?? 0)
  }

  // 18b. production_summary liées aux variétés test (cache matérialisé)
  if (testVarietyIds.length > 0) {
    const { count } = await admin
      .from('production_summary')
      .delete({ count: 'exact' })
      .in('variety_id', testVarietyIds)
    log('production_summary', count ?? 0)
  }

  // 19. varieties test (en dernier, car tout le monde y fait référence)
  if (testVarietyIds.length > 0) {
    const { count, error } = await admin
      .from('varieties')
      .delete({ count: 'exact' })
      .in('id', testVarietyIds)
    if (error) {
      process.stdout.write(`  ⚠️ varieties: erreur suppression: ${error.message}\n`)
      // Fallback : tenter un par un
      for (const vid of testVarietyIds) {
        const { error: err2 } = await admin.from('varieties').delete().eq('id', vid)
        if (err2) process.stdout.write(`  ⚠️ varieties ${vid}: ${err2.message}\n`)
      }
    } else {
      log('varieties', count ?? 0)
    }
  }
}
