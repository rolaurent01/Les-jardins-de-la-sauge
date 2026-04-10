'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type {
  ActionResult,
  SupportTicketAdmin,
  SupportTicket,
  SupportTicketMessageWithAuthor,
  SupportTicketStatus,
} from '@/lib/types'

const VALID_STATUSES: SupportTicketStatus[] = ['new', 'in_progress', 'resolved', 'closed']

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Compte les tickets "new" (pour le badge sidebar admin) */
export async function getNewTicketCount(): Promise<number> {
  await requireAdmin()
  const admin = createAdminClient()

  const { count, error } = await admin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')

  if (error) return 0
  return count ?? 0
}

/** Stats des tickets par statut */
export async function getTicketStats(): Promise<Record<SupportTicketStatus, number>> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('support_tickets')
    .select('status')

  if (error) throw new Error(`Erreur stats : ${error.message}`)

  const stats: Record<SupportTicketStatus, number> = {
    new: 0, in_progress: 0, resolved: 0, closed: 0,
  }

  for (const row of data ?? []) {
    const s = row.status as SupportTicketStatus
    if (s in stats) stats[s]++
  }

  return stats
}

/** Récupère tous les tickets avec pagination, filtres et recherche */
export async function getAllTickets(params: {
  page?: number
  status?: SupportTicketStatus | 'all'
  type?: string | 'all'
  search?: string
}): Promise<{ tickets: SupportTicketAdmin[]; total: number }> {
  await requireAdmin()
  const admin = createAdminClient()

  const page = params.page ?? 1
  const perPage = 25
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = admin
    .from('support_tickets')
    .select('*', { count: 'exact' })

  // Filtres
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.type && params.type !== 'all') {
    query = query.eq('type', params.type as 'bug' | 'suggestion' | 'question')
  }
  if (params.search && params.search.length >= 3) {
    const sanitized = params.search.replace(/[%_]/g, '\\$&')
    query = query.or(`subject.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
  }

  const { data: tickets, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(`Erreur tickets : ${error.message}`)

  // Enrichir avec email auteur et nom organisation
  const ticketList = tickets ?? []
  if (ticketList.length === 0) return { tickets: [], total: 0 }

  const userIds = [...new Set(ticketList.map(t => t.created_by))]
  const orgIds = [...new Set(ticketList.map(t => t.organization_id))]
  const ticketIds = ticketList.map(t => t.id)

  // Requêtes parallèles
  const [authRes, orgsRes, messagesRes] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from('organizations').select('id, nom').in('id', orgIds),
    admin.from('support_ticket_messages').select('ticket_id').in('ticket_id', ticketIds),
  ])

  const emailMap = new Map<string, string>()
  for (const u of authRes.data?.users ?? []) {
    if (userIds.includes(u.id)) emailMap.set(u.id, u.email ?? '')
  }

  const orgMap = new Map<string, string>()
  for (const o of orgsRes.data ?? []) orgMap.set(o.id, o.nom)

  const msgCountMap = new Map<string, number>()
  for (const m of messagesRes.data ?? []) {
    msgCountMap.set(m.ticket_id, (msgCountMap.get(m.ticket_id) ?? 0) + 1)
  }

  const enriched: SupportTicketAdmin[] = ticketList.map(t => ({
    ...t,
    message_count: msgCountMap.get(t.id) ?? 0,
    author_email: emailMap.get(t.created_by) ?? null,
    organization_name: orgMap.get(t.organization_id) ?? null,
  })) as SupportTicketAdmin[]

  return { tickets: enriched, total: count ?? 0 }
}

/** Détail d'un ticket avec ses messages (admin) */
export async function getTicketDetailAdmin(ticketId: string): Promise<{
  ticket: SupportTicket
  messages: SupportTicketMessageWithAuthor[]
  author_email: string | null
  organization_name: string | null
} | null> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single()

  if (!ticket) return null

  const { data: messages } = await admin
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  // Récupérer les emails des auteurs
  const authorIds = [...new Set([
    ticket.created_by,
    ...(messages ?? []).map(m => m.author_id),
  ])]

  const { data: authData } = await admin.auth.admin.listUsers()
  const users = (authData?.users ?? [])
    .filter(u => authorIds.includes(u.id))
    .map(u => ({ id: u.id, email: u.email ?? '' }))

  const emailMap = new Map<string, string>()
  for (const u of users ?? []) emailMap.set(u.id, u.email)

  // Nom organisation
  const { data: org } = await admin
    .from('organizations')
    .select('nom')
    .eq('id', ticket.organization_id)
    .single()

  const enrichedMessages: SupportTicketMessageWithAuthor[] = (messages ?? []).map(m => ({
    ...m,
    author_email: emailMap.get(m.author_id) ?? null,
  })) as SupportTicketMessageWithAuthor[]

  return {
    ticket: ticket as SupportTicket,
    messages: enrichedMessages,
    author_email: emailMap.get(ticket.created_by) ?? null,
    organization_name: org?.nom ?? null,
  }
}

/** Met à jour le statut d'un ticket */
export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicketStatus
): Promise<ActionResult> {
  await requireAdmin()

  if (!VALID_STATUSES.includes(status)) {
    return { error: 'Statut invalide.' }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('support_tickets')
    .update({ status })
    .eq('id', ticketId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Assigne un ticket à un admin */
export async function assignTicket(
  ticketId: string,
  adminId: string | null
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('support_tickets')
    .update({ assigned_to: adminId })
    .eq('id', ticketId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Ajoute une réponse admin sur un ticket */
export async function addAdminReply(
  ticketId: string,
  content: string
): Promise<ActionResult> {
  const adminUserId = await requireAdmin()
  const admin = createAdminClient()

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 5000) {
    return { error: 'Le message est obligatoire (5000 caractères max).' }
  }

  const { error } = await admin
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      author_id: adminUserId,
      content: trimmed,
      is_admin_reply: true,
    })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}
