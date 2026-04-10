'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ChangelogEntryWithRead,
  SupportTicketWithCount,
  SupportTicket,
  SupportTicketMessage,
} from '@/lib/types'
import {
  CHANGELOG_TYPE_LABELS,
  CHANGELOG_TYPE_COLORS,
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
} from '@/lib/types'
import {
  markChangelogAsRead,
  markAllChangelogAsRead,
  createTicket,
  getTicketDetail,
  addTicketMessage,
} from '@/app/[orgSlug]/(dashboard)/assistance/actions'

type Tab = 'changelog' | 'support'

export default function AssistanceClient({
  initialChangelog,
  initialTickets,
}: {
  initialChangelog: ChangelogEntryWithRead[]
  initialTickets: SupportTicketWithCount[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [tab, setTab] = useState<Tab>('changelog')
  const [changelog, setChangelog] = useState(initialChangelog)
  const [tickets, setTickets] = useState(initialTickets)
  const [error, setError] = useState<string | null>(null)

  // Détail ticket
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([])
  const [newMessage, setNewMessage] = useState('')

  // Formulaire nouveau ticket
  const [showNewTicket, setShowNewTicket] = useState(false)

  useEffect(() => { setChangelog(initialChangelog) }, [initialChangelog])
  useEffect(() => { setTickets(initialTickets) }, [initialTickets])

  const unreadCount = changelog.filter(e => !e.is_read).length

  // ── Changelog handlers ──

  async function handleMarkRead(entryId: string) {
    setChangelog(prev => prev.map(e =>
      e.id === entryId ? { ...e, is_read: true } : e
    ))
    startTransition(async () => {
      const res = await markChangelogAsRead(entryId)
      if ('error' in res) setError(res.error ?? null)
      else router.refresh()
    })
  }

  async function handleMarkAllRead() {
    setChangelog(prev => prev.map(e => ({ ...e, is_read: true })))
    startTransition(async () => {
      const res = await markAllChangelogAsRead()
      if ('error' in res) setError(res.error ?? null)
      else router.refresh()
    })
  }

  // ── Ticket handlers ──

  async function handleCreateTicket(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createTicket(formData)
      if ('error' in res) {
        setError(res.error ?? null)
      } else {
        setShowNewTicket(false)
        router.refresh()
      }
    })
  }

  async function handleOpenTicket(ticketId: string) {
    startTransition(async () => {
      const detail = await getTicketDetail(ticketId)
      if (detail) {
        setSelectedTicket(detail.ticket)
        setTicketMessages(detail.messages)
      }
    })
  }

  async function handleSendMessage() {
    if (!selectedTicket || !newMessage.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addTicketMessage(selectedTicket.id, newMessage)
      if ('error' in res) {
        setError(res.error ?? null)
      } else {
        setNewMessage('')
        // Recharger le détail
        const detail = await getTicketDetail(selectedTicket.id)
        if (detail) {
          setSelectedTicket(detail.ticket)
          setTicketMessages(detail.messages)
        }
        router.refresh()
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-4" style={{ color: '#2C3E2D' }}>
        Assistance
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <TabButton
          active={tab === 'changelog'}
          onClick={() => { setTab('changelog'); setSelectedTicket(null) }}
          badge={unreadCount > 0 ? unreadCount : undefined}
        >
          Mises à jour
        </TabButton>
        <TabButton
          active={tab === 'support'}
          onClick={() => { setTab('support'); setSelectedTicket(null) }}
        >
          Support
        </TabButton>
      </div>

      {/* ─── Onglet Changelog ─── */}
      {tab === 'changelog' && (
        <div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="mb-4 text-sm px-3 py-1.5 rounded-md"
              style={{
                backgroundColor: 'var(--color-primary, #3A5A40)',
                color: '#fff',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Tout marquer comme lu ({unreadCount})
            </button>
          )}

          {changelog.length === 0 ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>Aucune mise à jour pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {changelog.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-xl p-4 relative"
                  style={{
                    backgroundColor: entry.is_read ? '#fff' : '#FFFBEB',
                    border: `1px solid ${entry.is_read ? '#E5E7EB' : '#FDE68A'}`,
                  }}
                  onClick={() => !entry.is_read && handleMarkRead(entry.id)}
                  role={entry.is_read ? undefined : 'button'}
                >
                  {/* Badge non-lu */}
                  {!entry.is_read && (
                    <span
                      className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#F59E0B' }}
                    />
                  )}

                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: CHANGELOG_TYPE_COLORS[entry.type].bg,
                        color: CHANGELOG_TYPE_COLORS[entry.type].text,
                      }}
                    >
                      {CHANGELOG_TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                      {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold mb-1" style={{ color: '#2C3E2D' }}>
                    {entry.title}
                  </h3>
                  <p className="text-sm whitespace-pre-line" style={{ color: '#4B5563' }}>
                    {entry.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Onglet Support ─── */}
      {tab === 'support' && !selectedTicket && (
        <div>
          <button
            onClick={() => setShowNewTicket(!showNewTicket)}
            className="mb-4 text-sm px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: 'var(--color-primary, #3A5A40)',
              color: '#fff',
            }}
          >
            {showNewTicket ? 'Annuler' : '+ Nouveau ticket'}
          </button>

          {/* Formulaire de création */}
          {showNewTicket && (
            <form
              action={handleCreateTicket}
              className="mb-6 p-4 rounded-xl space-y-3"
              style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Sujet *</label>
                <input
                  name="subject"
                  required
                  maxLength={300}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ border: '1px solid #D1D5DB' }}
                  placeholder="Décrivez brièvement le problème ou la suggestion"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Description *</label>
                <textarea
                  name="description"
                  required
                  maxLength={5000}
                  rows={4}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ border: '1px solid #D1D5DB' }}
                  placeholder="Détaillez le contexte, les étapes pour reproduire, etc."
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Type</label>
                  <select name="type" defaultValue="bug" className="w-full text-sm rounded-lg px-3 py-2" style={{ border: '1px solid #D1D5DB' }}>
                    <option value="bug">Bug</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="question">Question</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Priorité</label>
                  <select name="priority" defaultValue="normal" className="w-full text-sm rounded-lg px-3 py-2" style={{ border: '1px solid #D1D5DB' }}>
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>URL de la page (optionnel)</label>
                <input
                  name="page_url"
                  type="text"
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ border: '1px solid #D1D5DB' }}
                  placeholder="Ex: /semis/sachets"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Capture d'écran (optionnel, 5 Mo max)</label>
                <input
                  name="screenshot"
                  type="file"
                  accept="image/*"
                  className="w-full text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="text-sm px-4 py-2 rounded-md"
                style={{
                  backgroundColor: 'var(--color-primary, #3A5A40)',
                  color: '#fff',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'Envoi...' : 'Envoyer le ticket'}
              </button>
            </form>
          )}

          {/* Liste des tickets */}
          {tickets.length === 0 ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>
              {showNewTicket ? '' : 'Aucun ticket pour le moment.'}
            </p>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => handleOpenTicket(ticket.id)}
                  className="w-full text-left rounded-xl p-4"
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    transition: 'all 150ms ease-out',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#FAFAFA' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#fff' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: TICKET_STATUS_COLORS[ticket.status].bg,
                        color: TICKET_STATUS_COLORS[ticket.status].text,
                      }}
                    >
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: TICKET_PRIORITY_COLORS[ticket.priority].bg,
                        color: TICKET_PRIORITY_COLORS[ticket.priority].text,
                      }}
                    >
                      {TICKET_PRIORITY_LABELS[ticket.priority]}
                    </span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                      {TICKET_TYPE_LABELS[ticket.type]}
                    </span>
                    {ticket.message_count > 0 && (
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        — {ticket.message_count} message{ticket.message_count > 1 ? 's' : ''}
                      </span>
                    )}
                    {ticket.has_unread_reply && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                      >
                        Nouvelle réponse
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
                    {ticket.subject}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                    {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Détail d'un ticket ─── */}
      {tab === 'support' && selectedTicket && (
        <div>
          <button
            onClick={() => setSelectedTicket(null)}
            className="mb-4 text-sm flex items-center gap-1"
            style={{ color: 'var(--color-primary, #3A5A40)' }}
          >
            ← Retour aux tickets
          </button>

          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: TICKET_STATUS_COLORS[selectedTicket.status].bg,
                  color: TICKET_STATUS_COLORS[selectedTicket.status].text,
                }}
              >
                {TICKET_STATUS_LABELS[selectedTicket.status]}
              </span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                {TICKET_TYPE_LABELS[selectedTicket.type]} — {TICKET_PRIORITY_LABELS[selectedTicket.priority]}
              </span>
            </div>
            <h2 className="text-base font-semibold mb-2" style={{ color: '#2C3E2D' }}>
              {selectedTicket.subject}
            </h2>
            <p className="text-sm whitespace-pre-line mb-2" style={{ color: '#4B5563' }}>
              {selectedTicket.description}
            </p>
            {selectedTicket.page_url && (
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Page : {selectedTicket.page_url}
              </p>
            )}
            {selectedTicket.screenshot_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedTicket.screenshot_url}
                alt="Capture d'écran"
                className="mt-2 rounded-lg max-w-full max-h-64 object-contain"
                style={{ border: '1px solid #E5E7EB' }}
              />
            )}
          </div>

          {/* Fil de messages */}
          <div className="space-y-2 mb-4">
            {ticketMessages.map(msg => (
              <div
                key={msg.id}
                className="rounded-lg p-3 text-sm"
                style={{
                  backgroundColor: msg.is_admin_reply ? '#EFF6FF' : '#fff',
                  border: `1px solid ${msg.is_admin_reply ? '#BFDBFE' : '#E5E7EB'}`,
                  marginLeft: msg.is_admin_reply ? '0' : '0',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: msg.is_admin_reply ? '#1E40AF' : '#374151' }}>
                    {msg.is_admin_reply ? 'Support' : 'Vous'}
                  </span>
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>
                    {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-line" style={{ color: '#374151' }}>
                  {msg.content}
                </p>
              </div>
            ))}
          </div>

          {/* Nouveau message */}
          {selectedTicket.status !== 'closed' && (
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Votre message..."
                rows={2}
                maxLength={5000}
                className="flex-1 text-sm rounded-lg px-3 py-2"
                style={{ border: '1px solid #D1D5DB' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isPending || !newMessage.trim()}
                className="self-end text-sm px-4 py-2 rounded-md"
                style={{
                  backgroundColor: 'var(--color-primary, #3A5A40)',
                  color: '#fff',
                  opacity: isPending || !newMessage.trim() ? 0.6 : 1,
                }}
              >
                Envoyer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant TabButton ──

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className="relative text-sm px-4 py-2"
      style={{
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-primary, #3A5A40)' : '#6B7280',
        borderBottom: active ? '2px solid var(--color-primary, #3A5A40)' : '2px solid transparent',
        transition: 'all 150ms ease-out',
        marginBottom: '-1px',
      }}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-1.5 inline-flex items-center justify-center text-xs font-medium rounded-full"
          style={{
            backgroundColor: '#F59E0B',
            color: '#fff',
            minWidth: '18px',
            height: '18px',
            padding: '0 5px',
            fontSize: '11px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
