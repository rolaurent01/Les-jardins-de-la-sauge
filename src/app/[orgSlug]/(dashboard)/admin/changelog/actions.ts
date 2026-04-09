'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type { ActionResult, ChangelogEntry, ChangelogEntryType } from '@/lib/types'

const VALID_TYPES: ChangelogEntryType[] = ['feature', 'improvement', 'fix']

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
