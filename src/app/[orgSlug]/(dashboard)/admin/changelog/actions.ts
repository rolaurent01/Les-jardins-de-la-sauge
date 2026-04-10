'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type { ActionResult, ChangelogEntry, ChangelogEntryType } from '@/lib/types'

const VALID_TYPES: ChangelogEntryType[] = ['feature', 'improvement', 'fix']

const GITHUB_REPO = 'rolaurent01/Les-jardins-de-la-sauge'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/commits`

/** Suggestion de changelog générée depuis un commit Git */
export type CommitSuggestion = {
  sha: string
  date: string
  title: string
  description: string
  type: ChangelogEntryType
}

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Récupère toutes les entrées changelog (y compris brouillons) */
export async function getAllChangelogEntries(): Promise<ChangelogEntry[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('changelog_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur changelog : ${error.message}`)
  return (data ?? []) as ChangelogEntry[]
}

/** Crée une entrée changelog */
export async function createChangelogEntry(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const type = formData.get('type') as string
  const published = formData.get('published') === 'true'

  if (!title || title.length > 300) {
    return { error: 'Le titre est obligatoire (300 caractères max).' }
  }
  if (!description || description.length > 5000) {
    return { error: 'La description est obligatoire (5000 caractères max).' }
  }
  if (!VALID_TYPES.includes(type as ChangelogEntryType)) {
    return { error: 'Type invalide.' }
  }

  const { error } = await admin
    .from('changelog_entries')
    .insert({
      title,
      description,
      type: type as 'feature' | 'improvement' | 'fix',
      published,
    })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Met à jour une entrée changelog */
export async function updateChangelogEntry(
  entryId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const type = formData.get('type') as string
  const published = formData.get('published') === 'true'

  if (!title || title.length > 300) {
    return { error: 'Le titre est obligatoire (300 caractères max).' }
  }
  if (!description || description.length > 5000) {
    return { error: 'La description est obligatoire (5000 caractères max).' }
  }
  if (!VALID_TYPES.includes(type as ChangelogEntryType)) {
    return { error: 'Type invalide.' }
  }

  const { error } = await admin
    .from('changelog_entries')
    .update({
      title,
      description,
      type: type as 'feature' | 'improvement' | 'fix',
      published,
    })
    .eq('id', entryId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Supprime une entrée changelog */
export async function deleteChangelogEntry(entryId: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('changelog_entries')
    .delete()
    .eq('id', entryId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ──────────────────────────────────────────────
// Import depuis les commits GitHub
// ──────────────────────────────────────────────

/** Mappe un type conventional commit vers un type changelog */
function mapCommitType(prefix: string): ChangelogEntryType | null {
  switch (prefix) {
    case 'feat': return 'feature'
    case 'fix': return 'fix'
    default: return null // chore, docs, refactor, test → ignorés
  }
}

/** Transforme un message conventional commit en titre lisible */
function humanizeCommitMessage(scope: string | null, message: string): string {
  // Première lettre en majuscule
  const capitalized = message.charAt(0).toUpperCase() + message.slice(1)
  if (scope) {
    // "semis" → "Semis"
    const humanScope = scope.charAt(0).toUpperCase() + scope.slice(1)
    return `${humanScope} : ${capitalized}`
  }
  return capitalized
}

/** Récupère les commits feat/fix depuis GitHub, filtrés par date du dernier changelog */
export async function fetchCommitSuggestions(): Promise<CommitSuggestion[]> {
  await requireAdmin()
  const admin = createAdminClient()

  // Trouver la date du dernier changelog publié pour ne pas proposer des doublons
  const { data: lastEntry } = await admin
    .from('changelog_entries')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const sinceDate = lastEntry?.created_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Récupérer les commits depuis GitHub (max 100)
  const url = `${GITHUB_API}?since=${sinceDate}&per_page=100`
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`GitHub API : ${res.status}`)

  const commits = await res.json() as {
    sha: string
    commit: {
      message: string
      committer: { date: string }
    }
  }[]

  // Parser les conventional commits et filtrer feat/fix
  const pattern = /^(feat|fix|chore|docs|refactor|test|style|perf)(?:\(([^)]+)\))?:\s*(.+)/

  const suggestions: CommitSuggestion[] = []

  for (const commit of commits) {
    const firstLine = commit.commit.message.split('\n')[0]
    const match = firstLine.match(pattern)
    if (!match) continue

    const [, prefix, scope, message] = match
    const type = mapCommitType(prefix)
    if (!type) continue // on ignore chore, docs, etc.

    suggestions.push({
      sha: commit.sha.slice(0, 7),
      date: commit.commit.committer.date,
      title: humanizeCommitMessage(scope ?? null, message.trim()),
      description: commit.commit.message.split('\n').slice(1).join('\n').trim() || message.trim(),
      type,
    })
  }

  return suggestions
}

/** Importe un batch de suggestions comme entrées changelog (brouillon par défaut) */
export async function importCommitSuggestions(
  suggestions: { title: string; description: string; type: ChangelogEntryType }[]
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  if (suggestions.length === 0) return { error: 'Aucune suggestion sélectionnée.' }

  const rows = suggestions.map(s => ({
    title: s.title.slice(0, 300),
    description: s.description.slice(0, 5000),
    type: s.type as 'feature' | 'improvement' | 'fix',
    published: false, // brouillon par défaut
  }))

  const { error } = await admin
    .from('changelog_entries')
    .insert(rows)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Toggle publié/brouillon */
export async function toggleChangelogPublished(
  entryId: string,
  published: boolean
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('changelog_entries')
    .update({ published })
    .eq('id', entryId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}
