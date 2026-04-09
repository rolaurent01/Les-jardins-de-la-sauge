import { createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'
import { NextResponse } from 'next/server'

/** Tables métier scopées par farm_id */
const TABLES_WITH_FARM_ID = [
  'sites', 'parcels', 'rows',
  'seed_lots', 'seedlings',
  'soil_works', 'plantings', 'row_care', 'harvests', 'uprootings', 'occultations',
  'cuttings', 'dryings', 'sortings',
  'stock_movements', 'stock_purchases', 'stock_direct_sales', 'stock_adjustments',
  'seed_stock_movements', 'seed_stock_adjustments',
  'recipes', 'production_lots', 'product_stock_movements',
  'forecasts', 'production_summary',
] as const

/** Tables du catalogue partagé (pas de farm_id) */
const CATALOG_TABLES = ['varieties', 'external_materials', 'product_categories'] as const

type BackupResult = {
  ok: boolean
  timestamp: string
  orgs_backed_up: number
  catalog_rows: number
  total_rows: number
  errors?: string[]
  error?: string
}

/**
 * Récupère le SHA du fichier GitHub s'il existe (pour pouvoir l'écraser).
 * Retourne null si le fichier n'existe pas encore.
 */
async function getExistingFileSha(
  token: string,
  repoPath: string,
  filename: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${repoPath}/contents/${filename}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub GET ${res.status}: ${body}`)
  }

  const json = (await res.json()) as { sha: string }
  return json.sha
}

/**
 * Pousse le contenu encodé en base64 vers GitHub.
 * Si sha est fourni, le fichier existant est écrasé (mise à jour).
 * Retourne le SHA du commit créé.
 */
async function pushToGithub(
  token: string,
  repoPath: string,
  filename: string,
  contentBase64: string,
  sha: string | null,
  commitMessage: string
): Promise<string> {
  const url = `https://api.github.com/repos/${repoPath}/contents/${filename}`

  const body: Record<string, unknown> = {
    message: commitMessage,
    content: contentBase64,
  }
  if (sha) body.sha = sha

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub PUT ${res.status}: ${text}`)
  }

  const json = (await res.json()) as { content: { sha: string } }
  return json.content.sha
}

/** Pousse un objet JSON vers GitHub sous un chemin donné */
async function pushJsonToGithub(
  token: string,
  repoPath: string,
  filePath: string,
  payload: unknown,
  commitMessage: string
): Promise<void> {
  const contentBase64 = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8').toString('base64')
  const existingSha = await getExistingFileSha(token, repoPath, filePath)
  await pushToGithub(token, repoPath, filePath, contentBase64, existingSha, commitMessage)
}

/**
 * Écrit une ligne dans app_logs.
 * Échoue silencieusement si la table n'existe pas encore.
 */
async function logToAppLogs(
  supabase: ReturnType<typeof createAdminClient>,
  level: 'info' | 'error',
  message: string,
  metadata?: Record<string, Json>
): Promise<void> {
  try {
    await supabase.from('app_logs').insert({
      level,
      source: 'backup-cron',
      message,
      metadata: metadata ?? null,
    })
  } catch {
    // Table app_logs absente — non bloquant
  }
}

/**
 * GET /api/backup
 * Exporte les données par organisation :
 *   - /shared/catalog-YYYY-MM-DD.json : catalogue partagé (varieties, external_materials, product_categories)
 *   - /orgs/{slug}/backup-YYYY-MM-DD.json : données métier scopées par ferme
 * Déclenché par cron Vercel à 3h UTC (vercel.json).
 */
export async function GET() {
  const supabase = createAdminClient()
  const timestamp = new Date().toISOString()
  const dateStr = timestamp.slice(0, 10) // YYYY-MM-DD

  const githubToken = process.env.GITHUB_BACKUP_TOKEN
  const githubRepo = process.env.GITHUB_BACKUP_REPO

  if (!githubToken || !githubRepo) {
    const error = 'Variables GITHUB_BACKUP_TOKEN ou GITHUB_BACKUP_REPO manquantes'
    await logToAppLogs(supabase, 'error', error)
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }

  const errors: string[] = []
  let totalRows = 0
  let catalogRows = 0

  // --- Étape 1 : export du catalogue partagé ---
  const catalogData: Record<string, unknown[]> = {}

  for (const table of CATALOG_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from(table).select('*')
      if (error) {
        errors.push(`catalog/${table}: ${error.message}`)
      } else {
        catalogData[table] = data ?? []
        catalogRows += (data ?? []).length
      }
    } catch (err) {
      errors.push(`catalog/${table}: ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }

  try {
    await pushJsonToGithub(
      githubToken,
      githubRepo,
      `shared/catalog-${dateStr}.json`,
      { exported_at: timestamp, tables: catalogData },
      `backup: catalogue partagé ${dateStr}`
    )
  } catch (err) {
    errors.push(`push catalog: ${err instanceof Error ? err.message : String(err)}`)
  }

  // --- Étape 2 : export par organisation ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgs } = await (supabase as any)
    .from('organizations')
    .select('id, slug')

  const orgList = (orgs ?? []) as { id: string; slug: string }[]
  let orgsBackedUp = 0

  for (const org of orgList) {
    try {
      // Récupérer toutes les fermes de cette organisation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: farms } = await (supabase as any)
        .from('farms')
        .select('id')
        .eq('organization_id', org.id)

      const farmIds = (farms ?? []).map((f: { id: string }) => f.id) as string[]
      if (farmIds.length === 0) continue

      const orgData: Record<string, unknown[]> = {}

      // Tables métier scopées par farm_id
      for (const table of TABLES_WITH_FARM_ID) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase as any)
            .from(table)
            .select('*')
            .in('farm_id', farmIds)

          if (error) {
            errors.push(`${org.slug}/${table}: ${error.message}`)
          } else {
            orgData[table] = data ?? []
            totalRows += (data ?? []).length
          }
        } catch (err) {
          errors.push(`${org.slug}/${table}: ${err instanceof Error ? err.message : 'erreur inconnue'}`)
        }
      }

      // Tables plateforme scopées par organisation / fermes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: memberships } = await (supabase as any)
        .from('memberships')
        .select('*')
        .eq('organization_id', org.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: farmAccess } = await (supabase as any)
        .from('farm_access')
        .select('*')
        .in('farm_id', farmIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: farmModules } = await (supabase as any)
        .from('farm_modules')
        .select('*')
        .in('farm_id', farmIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: farmVarietySettings } = await (supabase as any)
        .from('farm_variety_settings')
        .select('*')
        .in('farm_id', farmIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: farmMaterialSettings } = await (supabase as any)
        .from('farm_material_settings')
        .select('*')
        .in('farm_id', farmIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: notifications } = await (supabase as any)
        .from('notifications')
        .select('*')
        .in('farm_id', farmIds)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: auditLog } = await (supabase as any)
        .from('audit_log')
        .select('*')
        .in('farm_id', farmIds)

      orgData['farms'] = farms ?? []
      orgData['memberships'] = memberships ?? []
      orgData['farm_access'] = farmAccess ?? []
      orgData['farm_modules'] = farmModules ?? []
      orgData['farm_variety_settings'] = farmVarietySettings ?? []
      orgData['farm_material_settings'] = farmMaterialSettings ?? []
      orgData['notifications'] = notifications ?? []
      orgData['audit_log'] = auditLog ?? []

      await pushJsonToGithub(
        githubToken,
        githubRepo,
        `orgs/${org.slug}/backup-${dateStr}.json`,
        { exported_at: timestamp, organization_id: org.id, tables: orgData },
        `backup: ${org.slug} ${dateStr}`
      )

      orgsBackedUp++
    } catch (err) {
      errors.push(`org ${org.slug}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // --- Étape 3 : log du résultat ---
  const result: BackupResult = {
    ok: errors.length === 0,
    timestamp,
    orgs_backed_up: orgsBackedUp,
    catalog_rows: catalogRows,
    total_rows: totalRows,
    errors: errors.length > 0 ? errors : undefined,
  }

  await logToAppLogs(supabase, errors.length > 0 ? 'error' : 'info', 'Backup terminé', {
    orgs_backed_up: orgsBackedUp,
    catalog_rows: catalogRows,
    total_rows: totalRows,
    errors_count: errors.length,
  })

  return NextResponse.json(result)
}
