import { getAllTickets, getTicketStats } from './actions'
import FeedbacksAdminClient from '@/components/admin/FeedbacksAdminClient'

export const metadata = { title: 'Feedbacks — Admin' }

export default async function FeedbacksAdminPage() {
  try {
    const [{ tickets, total }, stats] = await Promise.all([
      getAllTickets({}),
      getTicketStats(),
    ])
    return (
      <FeedbacksAdminClient
        initialTickets={tickets}
        initialTotal={total}
        initialStats={stats}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}
