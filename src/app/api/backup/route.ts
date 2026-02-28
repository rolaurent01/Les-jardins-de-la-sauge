import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Tables à inclure dans le backup quotidien
const TABLES_TO_BACKUP = [
  'varieties',
  'external_materials',
  'sites',
  'parcels',
  'rows',
  'seed_lots',
  'seedlings',
  'soil_works',
  'plantings',
  'row_care',
  'harvests',
  'uprootings',
  'cuttings',
  'dryings',
  'sortings',
  'recipes',
  'recipe_ingredients',
  'production_batches',
  'stock_movements',
  'purchases',
  'sales',
  'stock_adjustments',
] as const

/**
 * GET /api/backup
 * Exporte toutes les tables critiques en JSON.
 * Déclenché par cron Vercel tous les jours à 3h UTC.
 *
 * TODO Phase A0 : envoyer le JSON vers un repo GitHub privé via l'API GitHub.
 * Pour l'instant : log du résumé en console et retour JSON (visible dans les logs Vercel).
 */
export async function GET() {
  const supabase = createAdminClient()
  const backup: Record<string, unknown[]> = {}
  const errors: string[] = []

  for (const table of TABLES_TO_BACKUP) {
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        // La table n'existe pas encore (schéma non migré) — on ignore silencieusement
        errors.push(`${table}: ${error.message}`)
      } else {
        backup[table] = data ?? []
      }
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }

  const summary = {
    ok: true,
    timestamp: new Date().toISOString(),
    tables_backed_up: Object.keys(backup).length,
    total_rows: Object.values(backup).reduce((sum, rows) => sum + rows.length, 0),
    errors: errors.length > 0 ? errors : undefined,
  }

  console.log('[backup]', JSON.stringify(summary))

  return NextResponse.json(summary)
}
