'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  SupportTicket,
  SupportTicketMessageWithAuthor,
  SupportTicketStatus,
} from '@/lib/types'
import {
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
} from '@/lib/types'
import {
  updateTicketStatus,
  addAdminReply,
} from '@/app/[orgSlug]/(dashboard)/admin/feedbacks/actions'

export default function TicketDetailAdminClient({
  ticket,
  messages,
  authorEmail,
  organizationName,
}: {
  ticket: SupportTicket
  messages: SupportTicketMessageWithAuthor[]
  authorEmail: string | null
  organizationName: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [status, setStatus] = useState(ticket.status)
  const [replyContent, setReplyContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleStatusChange(newStatus: SupportTicketStatus) {
    setStatus(newStatus)
    startTransition(async () => {
      const res = await updateTicketStatus(ticket.id, newStatus)
      if ('error' in res) {
        setError(res.error ?? null)
        setStatus(ticket.status)
      } else {
        router.refresh()
      }
    })
  }

  async function handleReply() {
    if (!replyContent.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addAdminReply(ticket.id, replyContent)
      if ('error' in res) {
        setError(res.error ?? null)
      } else {
        setReplyContent('')
        router.refresh()
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm flex items-center gap-1"
        style={{ color: 'var(--color-primary, #3A5A40)' }}
      >
        ← Retour à la liste
      </button>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* En-tête ticket */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value as SupportTicketStatus)}
            disabled={isPending}
            className="text-xs px-2 py-1 rounded-md font-medium"
            style={{
              backgroundColor: TICKET_STATUS_COLORS[status].bg,
              color: TICKET_STATUS_COLORS[status].text,
              border: 'none',
            }}
          >
            <option value="new">Nouveau</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolu</option>
            <option value="closed">Fermé</option>
          </select>
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
        </div>

        <h2 className="text-base font-semibold mb-2" style={{ color: '#2C3E2D' }}>
          {ticket.subject}
        </h2>

        {/* Métadonnées */}
        <div className="flex gap-4 mb-3 flex-wrap text-xs" style={{ color: '#6B7280' }}>
          <span>Auteur : <strong>{authorEmail ?? '—'}</strong></span>
          <span>Organisation : <strong>{organizationName ?? '—'}</strong></span>
          <span>Créé le {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}</span>
        </div>

        <p className="text-sm whitespace-pre-line mb-3" style={{ color: '#4B5563' }}>
          {ticket.description}
        </p>

        {ticket.page_url && (
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>
            Page : <code className="bg-gray-100 px-1 rounded">{ticket.page_url}</code>
          </p>
        )}

        {ticket.screenshot_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ticket.screenshot_url}
            alt="Capture d'écran"
            className="mt-2 rounded-lg max-w-full max-h-80 object-contain"
            style={{ border: '1px solid #E5E7EB' }}
          />
        )}
      </div>

      {/* Fil de messages */}
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#2C3E2D' }}>
        Fil de discussion ({messages.length})
      </h3>

      <div className="space-y-2 mb-4">
        {messages.length === 0 && (
          <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun message.</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className="rounded-lg p-3 text-sm"
            style={{
              backgroundColor: msg.is_admin_reply ? '#EFF6FF' : '#fff',
              border: `1px solid ${msg.is_admin_reply ? '#BFDBFE' : '#E5E7EB'}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium" style={{ color: msg.is_admin_reply ? '#1E40AF' : '#374151' }}>
                {msg.is_admin_reply ? 'Admin' : (msg.author_email ?? 'Utilisateur')}
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

      {/* Réponse admin */}
      <div className="flex gap-2">
        <textarea
          value={replyContent}
          onChange={e => setReplyContent(e.target.value)}
          placeholder="Répondre au ticket..."
          rows={3}
          maxLength={5000}
          className="flex-1 text-sm rounded-lg px-3 py-2"
          style={{ border: '1px solid #D1D5DB' }}
        />
        <button
          onClick={handleReply}
          disabled={isPending || !replyContent.trim()}
          className="self-end text-sm px-4 py-2 rounded-md"
          style={{
            backgroundColor: 'var(--color-primary, #3A5A40)',
            color: '#fff',
            opacity: isPending || !replyContent.trim() ? 0.6 : 1,
          }}
        >
          Répondre
        </button>
      </div>
    </div>
  )
}
