'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import type { ActionResult } from '@/lib/types'

/** Vérifie que l'utilisateur courant est super admin */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Entrée de log applicatif */
export type AppLog = {
  id: string
  level: 'info' | 'warn' | 'error'
  source: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/** Filtres pour la recherche de logs */
export type LogFilters = {
  level?: 'info' | 'warn' | 'error' | null
  source?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
  page?: number
}

const PAGE_SIZE = 50

/** Récupère les logs avec filtres et pagination */
export async function fetchLogs(filters: LogFilters = {}): Promise<{
  logs: AppLog[]
  total: number
  page: number
  pageSize: number
}> {
  await requireAdmin()
  const admin = createAdminClient()
  const page = filters.page ?? 1
  const offset = (page - 1) * PAGE_SIZE

  // Requête de base avec filtres
  let query = admin
    .from('app_logs')
    .select('*', { count: 'exact' })

  if (filters.level) {
    query = query.eq('level', filters.level)
  }
  if (filters.source) {
    query = query.eq('source', filters.source)
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters.dateTo) {
    // Inclure toute la journée de fin
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
  }
  if (filters.search) {
    // Recherche dans message et metadata (cast en texte)
    query = query.or(`message.ilike.%${filters.search}%,metadata::text.ilike.%${filters.search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data, count, error } = await query

  if (error) throw new Error(`Erreur : ${error.message}`)

  return {
    logs: (data ?? []) as AppLog[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  }
}

/** Compteurs par niveau de log */
export type LogCounts = {
  info: number
  warn: number
  error: number
  total: number
}

/** Retourne les compteurs par niveau */
export async function countLogsByLevel(): Promise<LogCounts> {
  await requireAdmin()
  const admin = createAdminClient()

  const [infoRes, warnRes, errorRes] = await Promise.all([
    admin.from('app_logs').select('id', { count: 'exact', head: true }).eq('level', 'info'),
    admin.from('app_logs').select('id', { count: 'exact', head: true }).eq('level', 'warn'),
    admin.from('app_logs').select('id', { count: 'exact', head: true }).eq('level', 'error'),
  ])

  const info = infoRes.count ?? 0
  const warn = warnRes.count ?? 0
  const error = errorRes.count ?? 0

  return { info, warn, error, total: info + warn + error }
}

/** Récupère les sources distinctes présentes dans les logs */
export async function fetchLogSources(): Promise<string[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('app_logs')
    .select('source')

  if (error) throw new Error(`Erreur : ${error.message}`)
  if (!data) return []

  // Extraction des valeurs uniques côté JS
  const uniqueSources = [...new Set(data.map(d => d.source))].sort()
  return uniqueSources
}

/** Supprime les logs plus anciens que N jours (défaut 90) */
export async function purgeLogs(olderThanDays: number = 90): Promise<ActionResult<{ deleted: number }>> {
  await requireAdmin()
  const admin = createAdminClient()

  if (olderThanDays < 1) return { error: 'Le nombre de jours doit être au minimum 1.' }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const { data, error } = await admin
    .from('app_logs')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id')

  if (error) return { error: `Erreur : ${error.message}` }

  return { success: true, data: { deleted: data?.length ?? 0 } }
}
