import { getChangelog, getMyTickets } from './actions'
import AssistanceClient from '@/components/assistance/AssistanceClient'

export const metadata = { title: 'Assistance — Carnet Culture' }

export default async function AssistancePage() {
  try {
    const [changelog, tickets] = await Promise.all([
      getChangelog(),
      getMyTickets(),
    ])

    return (
      <AssistanceClient
        initialChangelog={changelog}
        initialTickets={tickets}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}
