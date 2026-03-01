import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type BackupResult = {
  ok: boolean
  timestamp: string
  filename: string
  tables_discovered: number
  tables_backed_up: number
  total_rows: number
  github_sha?: string
  errors?: string[]
  error?: string
}

/**
 * Découvre dynamiquement toutes les tables du schéma public via l'endpoint
 * OpenAPI de Supabase (/rest/v1/). Toute nouvelle table est automatiquement
 * incluse dans le backup sans modifier le code.
 * Exclut les vues système (préfixe pg_ ou préfixes information_schema).
 */
async function discoverPublicTables(): Promise<string[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Impossible de récupérer le schéma Supabase: ${res.status}`)
  }

  // L'endpoint retourne la spec OpenAPI — les tables sont dans "definitions"
  const spec = (await res.json()) as { definitions?: Record<string, unknown> }
  const allNames = Object.keys(spec.definitions ?? {})

  // Filtre : on conserve uniquement les tables métier (exclut les vues système)
  return allNames.filter(
    (name) => !name.startsWith('pg_') && !name.startsWith('_')
  )
}

/**
 * Exporte toutes les tables du schéma public en JSON.
 * Utilise la découverte dynamique — aucune liste à maintenir.
 */
async function exportAllTables(): Promise<{
  data: Record<string, unknown[]>
  discovered: string[]
  errors: string[]
}> {
  const supabase = createAdminClient()
  const data: Record<string, unknown[]> = {}
  const errors: string[] = []

  const discovered = await discoverPublicTables()

  for (const table of discovered) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows, error } = await (supabase as any).from(table).select('*')
      if (error) {
        errors.push(`${table}: ${error.message}`)
      } else {
        data[table] = rows ?? []
      }
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }

  return { data, discovered, errors }
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

/**
 * Écrit une ligne dans app_logs.
 * Échoue silencieusement si la table n'existe pas encore.
 */
async function logToAppLogs(
  supabase: ReturnType<typeof createAdminClient>,
  level: 'info' | 'error',
  message: string,
  metadata?: Record<string, unknown>
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
 * Découvre dynamiquement toutes les tables du schéma public, les exporte en JSON,
 * et pousse le fichier sur GitHub. Déclenché par cron Vercel à 3h UTC (vercel.json).
 * Accessible manuellement en local via curl http://localhost:3000/api/backup
 */
export async function GET() {
  const supabase = createAdminClient()
  const timestamp = new Date().toISOString()
  const dateStr = timestamp.slice(0, 10) // YYYY-MM-DD
  const filename = `backup-${dateStr}.json`

  const githubToken = process.env.GITHUB_BACKUP_TOKEN
  const githubRepo = process.env.GITHUB_BACKUP_REPO

  if (!githubToken || !githubRepo) {
    const error = 'Variables GITHUB_BACKUP_TOKEN ou GITHUB_BACKUP_REPO manquantes'
    await logToAppLogs(supabase, 'error', error, { filename })
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }

  // --- Étape 1 : découverte dynamique + export ---
  let backupData: Record<string, unknown[]>
  let discovered: string[]
  let exportErrors: string[]

  try {
    const result = await exportAllTables()
    backupData = result.data
    discovered = result.discovered
    exportErrors = result.errors
  } catch (err) {
    const error = `Échec de la découverte des tables: ${err instanceof Error ? err.message : String(err)}`
    await logToAppLogs(supabase, 'error', error, { filename })
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }

  const payload = {
    exported_at: timestamp,
    tables_discovered: discovered,
    tables: backupData,
    export_errors: exportErrors.length > 0 ? exportErrors : undefined,
  }

  const jsonContent = JSON.stringify(payload, null, 2)
  const contentBase64 = Buffer.from(jsonContent, 'utf-8').toString('base64')

  // --- Étape 2 : récupérer le SHA si le fichier du jour existe déjà ---
  let existingSha: string | null = null
  try {
    existingSha = await getExistingFileSha(githubToken, githubRepo, filename)
  } catch (err) {
    const error = `Impossible de vérifier l'existence du fichier GitHub: ${err instanceof Error ? err.message : String(err)}`
    await logToAppLogs(supabase, 'error', error, { filename })
    return NextResponse.json({ ok: false, error }, { status: 502 })
  }

  // --- Étape 3 : push GitHub ---
  const action = existingSha ? 'mise à jour' : 'création'
  const commitMessage = `backup: ${action} ${filename}`

  let githubSha: string
  try {
    githubSha = await pushToGithub(
      githubToken,
      githubRepo,
      filename,
      contentBase64,
      existingSha,
      commitMessage
    )
  } catch (err) {
    const error = `Échec du push GitHub: ${err instanceof Error ? err.message : String(err)}`
    await logToAppLogs(supabase, 'error', error, { filename })
    return NextResponse.json({ ok: false, error }, { status: 502 })
  }

  // --- Étape 4 : log du succès ---
  const result: BackupResult = {
    ok: true,
    timestamp,
    filename,
    tables_discovered: discovered.length,
    tables_backed_up: Object.keys(backupData).length,
    total_rows: Object.values(backupData).reduce((sum, rows) => sum + rows.length, 0),
    github_sha: githubSha,
    errors: exportErrors.length > 0 ? exportErrors : undefined,
  }

  await logToAppLogs(supabase, 'info', `Backup ${action} avec succès`, {
    filename,
    tables_discovered: discovered.length,
    tables_backed_up: result.tables_backed_up,
    total_rows: result.total_rows,
    github_sha: githubSha,
  })

  return NextResponse.json(result)
}
