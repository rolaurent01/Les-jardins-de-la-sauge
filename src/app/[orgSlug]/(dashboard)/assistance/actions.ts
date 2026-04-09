'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type {
  ActionResult,
  ChangelogEntryWithRead,
  SupportTicket,
  SupportTicketWithCount,
  SupportTicketMessage,
} from '@/lib/types'

const REVALIDATE_PATH = '/assistance'

// ──────────────────────────────────────────────
// Changelog — côté utilisateur
// ──────────────────────────────────────────────

/** Récupère les entrées changelog publiées avec le statut de lecture */
export async function getChangelog(): Promise<ChangelogEntryWithRead[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  // Récupérer les entrées publiées
  const { data: entries, error } = await admin
    .from('changelog_entries')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur changelog : ${error.message}`)

  // Récupérer les lectures de l'utilisateur
  const { data: reads } = await admin
    .from('changelog_reads')
    .select('entry_id')
    .eq('user_id', user.id)

  const readEntryIds = new Set((reads ?? []).map(r => r.entry_id))

  return (entries ?? []).map(entry => ({
    ...entry,
    is_read: readEntryIds.has(entry.id),
  })) as ChangelogEntryWithRead[]
}

/** Compte le nombre d'entrées changelog non lues (pour le badge sidebar) */
export async function getUnreadChangelogCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const admin = createAdminClient()

  // Compter les entrées publiées
  const { count: totalCount } = await admin
    .from('changelog_entries')
    .select('id', { count: 'exact', head: true })
    .eq('published', true)

  // Compter les lectures de l'utilisateur
  const { count: readCount } = await admin
    .from('changelog_reads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (totalCount ?? 0) - (readCount ?? 0)
}

/** Marque une entrée changelog comme lue */
export async function markChangelogAsRead(entryId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { error } = await supabase
    .from('changelog_reads')
    .upsert(
      { entry_id: entryId, user_id: user.id },
      { onConflict: 'entry_id,user_id' }
    )

  if (error) return { error: mapSupabaseError(error) }

  const { orgSlug } = await getContext()
  revalidatePath(buildPath(orgSlug, REVALIDATE_PATH))
  return { success: true }
}

/** Marque toutes les entrées changelog comme lues */
export async function markAllChangelogAsRead(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const admin = createAdminClient()

  // Récupérer toutes les entrées publiées
  const { data: entries } = await admin
    .from('changelog_entries')
    .select('id')
    .eq('published', true)

  if (!entries || entries.length === 0) return { success: true }

  // Récupérer les lectures existantes
  const { data: reads } = await admin
    .from('changelog_reads')
    .select('entry_id')
    .eq('user_id', user.id)

  const alreadyRead = new Set((reads ?? []).map(r => r.entry_id))
  const toMark = entries.filter(e => !alreadyRead.has(e.id))

  if (toMark.length > 0) {
    const { error } = await supabase
      .from('changelog_reads')
      .insert(toMark.map(e => ({ entry_id: e.id, user_id: user.id })))

    if (error) return { error: mapSupabaseError(error) }
  }

  const { orgSlug } = await getContext()
  revalidatePath(buildPath(orgSlug, REVALIDATE_PATH))
  return { success: true }
}

// ──────────────────────────────────────────────
// Support tickets — côté utilisateur
// ──────────────────────────────────────────────

/** Crée un ticket de support avec upload optionnel de screenshot */
export async function createTicket(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, organizationId, orgSlug } = await getContext()

  const subject = (formData.get('subject') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const type = formData.get('type') as string
  const priority = formData.get('priority') as string
  const pageUrl = (formData.get('page_url') as string)?.trim() || null
  const screenshot = formData.get('screenshot') as File | null

  // Validation
  if (!subject || subject.length > 300) {
    return { error: 'Le sujet est obligatoire (300 caractères max).' }
  }
  if (!description || description.length > 5000) {
    return { error: 'La description est obligatoire (5000 caractères max).' }
  }
  if (!['bug', 'suggestion', 'question'].includes(type)) {
    return { error: 'Type invalide.' }
  }
  if (!['low', 'normal', 'urgent'].includes(priority)) {
    return { error: 'Priorité invalide.' }
  }

  // Upload screenshot si fourni
  let screenshotUrl: string | null = null
  if (screenshot && screenshot.size > 0) {
    const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo
    if (screenshot.size > MAX_SIZE) {
      return { error: 'L\'image dépasse 5 Mo.' }
    }

    const ext = screenshot.name.split('.').pop() || 'png'
    const path = `${organizationId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('support-screenshots')
      .upload(path, screenshot)

    if (uploadError) return { error: `Erreur upload : ${mapSupabaseError(uploadError)}` }

    const { data: urlData } = supabase.storage
      .from('support-screenshots')
      .getPublicUrl(path)

    screenshotUrl = urlData.publicUrl
  }

  const { error } = await supabase
    .from('support_tickets')
    .insert({
      subject,
      description,
      type: type as 'bug' | 'suggestion' | 'question',
      priority: priority as 'low' | 'normal' | 'urgent',
      page_url: pageUrl,
      screenshot_url: screenshotUrl,
      organization_id: organizationId,
      created_by: userId,
    })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, REVALIDATE_PATH))
  return { success: true }
}

/** Récupère les tickets de l'utilisateur connecté */
export async function getMyTickets(): Promise<SupportTicketWithCount[]> {
  const { userId } = await getContext()
  const admin = createAdminClient()

  const { data: tickets, error } = await admin
    .from('support_tickets')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur tickets : ${error.message}`)

  // Compter les messages par ticket
  const ticketIds = (tickets ?? []).map(t => t.id)
  if (ticketIds.length === 0) return []

  const { data: messages } = await admin
    .from('support_ticket_messages')
    .select('ticket_id')
    .in('ticket_id', ticketIds)

  const countMap = new Map<string, number>()
  for (const msg of messages ?? []) {
    countMap.set(msg.ticket_id, (countMap.get(msg.ticket_id) ?? 0) + 1)
  }

  return (tickets ?? []).map(t => ({
    ...t,
    message_count: countMap.get(t.id) ?? 0,
  })) as SupportTicketWithCount[]
}

/** Récupère le détail d'un ticket (vérifie que l'utilisateur en est l'auteur) */
export async function getTicketDetail(ticketId: string): Promise<{
  ticket: SupportTicket
  messages: SupportTicketMessage[]
} | null> {
  const { userId } = await getContext()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('created_by', userId)
    .single()

  if (!ticket) return null

  const { data: messages } = await admin
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  return {
    ticket: ticket as SupportTicket,
    messages: (messages ?? []) as SupportTicketMessage[],
  }
}

/** Ajoute un message à un ticket (côté utilisateur) */
export async function addTicketMessage(
  ticketId: string,
  content: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 5000) {
    return { error: 'Le message est obligatoire (5000 caractères max).' }
  }

  // Vérifier que le ticket appartient à l'utilisateur
  const admin = createAdminClient()
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id')
    .eq('id', ticketId)
    .eq('created_by', userId)
    .single()

  if (!ticket) return { error: 'Ticket introuvable.' }

  const { error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      author_id: userId,
      content: trimmed,
      is_admin_reply: false,
    })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, REVALIDATE_PATH))
  return { success: true }
}
