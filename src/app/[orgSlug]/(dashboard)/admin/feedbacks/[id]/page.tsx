import { getTicketDetailAdmin } from '../actions'
import TicketDetailAdminClient from '@/components/admin/TicketDetailAdminClient'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Détail ticket — Admin' }

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const detail = await getTicketDetailAdmin(id)
    if (!detail) notFound()

    return (
      <TicketDetailAdminClient
        ticket={detail.ticket}
        messages={detail.messages}
        authorEmail={detail.author_email}
        organizationName={detail.organization_name}
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
