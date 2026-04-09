'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { SupportTicketAdmin, SupportTicketStatus } from '@/lib/types'
import {
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
} from '@/lib/types'
import { getAllTickets } from '@/app/[orgSlug]/(dashboard)/admin/feedbacks/actions'

export default function FeedbacksAdminClient({
  initialTickets,
  initialTotal,
  initialStats,
}: {
  initialTickets: SupportTicketAdmin[]
  initialTotal: number
  initialStats: Record<SupportTicketStatus, number>
}) {
  const router = useRouter()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [isPending, startTransition] = useTransition()

  const [tickets, setTickets] = useState(initialTickets)
  const [total, setTotal] = useState(initialTotal)
  const [stats] = useState(initialStats)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<SupportTicketStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')

  const perPage = 25
  const totalPages = Math.ceil(total / perPage)

  function fetchFiltered(p: number, status: SupportTicketStatus | 'all', type: string, s: string) {
    startTransition(async () => {
      const res = await getAllTickets({
        page: p,
        status,
        type,
        search: s.length >= 3 ? s : undefined,
      })
      setTickets(res.tickets)
      setTotal(res.total)
    })
  }

  function handleFilterChange(status: SupportTicketStatus | 'all', type: string) {
    setFilterStatus(status)
    setFilterType(type)
    setPage(1)
    fetchFiltered(1, status, type, search)
  }

  function handleSearch(value: string) {
    setSearch(value)
    if (value.length >= 3 || value.length === 0) {
      setPage(1)
      fetchFiltered(1, filterStatus, filterType, value)
    }
  }

  function handlePageChange(p: number) {
    setPage(p)
    fetchFiltered(p, filterStatus, filterType, search)
  }

  const statCards: { key: SupportTicketStatus; label: string; color: string }[] = [
    { key: 'new', label: 'Nouveaux', color: '#1E40AF' },
    { key: 'in_progress', label: 'En cours', color: '#92400E' },
    { key: 'resolved', label: 'Résolus', color: '#065F46' },
    { key: 'closed', label: 'Fermés', color: '#6B7280' },
  ]

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-lg font-semibold mb-4" style={{ color: '#2C3E2D' }}>
        Gestion des feedbacks
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {statCards.map(card => (
          <div
            key={card.key}
            className="rounded-xl p-3 text-center"
            style={{
              backgroundColor: TICKET_STATUS_COLORS[card.key].bg,
              border: `1px solid ${TICKET_STATUS_COLORS[card.key].bg}`,
            }}
          >
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {stats[card.key]}
            </p>
            <p className="text-xs" style={{ color: card.color, opacity: 0.8 }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Rechercher (min. 3 caractères)..."
          className="text-sm rounded-lg px-3 py-2 w-64"
          style={{ border: '1px solid #D1D5DB' }}
        />
        <select
          value={filterStatus}
          onChange={e => handleFilterChange(e.target.value as SupportTicketStatus | 'all', filterType)}
          className="text-sm rounded-lg px-3 py-2"
          style={{ border: '1px solid #D1D5DB' }}
        >
          <option value="all">Tous les statuts</option>
          <option value="new">Nouveau</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Résolu</option>
          <option value="closed">Fermé</option>
        </select>
        <select
          value={filterType}
          onChange={e => handleFilterChange(filterStatus, e.target.value)}
          className="text-sm rounded-lg px-3 py-2"
          style={{ border: '1px solid #D1D5DB' }}
        >
          <option value="all">Tous les types</option>
          <option value="bug">Bug</option>
          <option value="suggestion">Suggestion</option>
          <option value="question">Question</option>
        </select>
      </div>

      {/* Tableau */}
      {tickets.length === 0 ? (
        <p className="text-sm" style={{ color: '#6B7280' }}>Aucun ticket trouvé.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Sujet</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Auteur</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Org.</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Priorité</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Statut</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Msgs</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: '#6B7280' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr
                    key={ticket.id}
                    onClick={() => router.push(`/${orgSlug}/admin/feedbacks/${ticket.id}`)}
                    className="cursor-pointer"
                    style={{ borderTop: '1px solid #F3F4F6' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FAFAFA' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                  >
                    <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" style={{ color: '#2C3E2D' }}>
                      {ticket.subject}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#6B7280' }}>
                      {ticket.author_email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#6B7280' }}>
                      {ticket.organization_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs">{TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: TICKET_PRIORITY_COLORS[ticket.priority].bg,
                          color: TICKET_PRIORITY_COLORS[ticket.priority].text,
                        }}
                      >
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: TICKET_STATUS_COLORS[ticket.status].bg,
                          color: TICKET_STATUS_COLORS[ticket.status].text,
                        }}
                      >
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#6B7280' }}>
                      {ticket.message_count}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#9CA3AF' }}>
                      {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1 mt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-md"
                  style={{
                    backgroundColor: p === page ? 'var(--color-primary, #3A5A40)' : '#F3F4F6',
                    color: p === page ? '#fff' : '#374151',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs mt-2 text-center" style={{ color: '#9CA3AF' }}>
            {total} ticket{total > 1 ? 's' : ''} au total
          </p>
        </>
      )}
    </div>
  )
}
