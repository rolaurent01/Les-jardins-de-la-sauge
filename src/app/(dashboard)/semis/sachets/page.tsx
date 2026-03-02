import { fetchSeedLots, fetchVarieties } from './actions'
import SachetsClient from '@/components/semis/SachetsClient'

export const metadata = { title: 'Sachets de graines — LJS' }

export default async function SachetsPage() {
  try {
    const [seedLots, varieties] = await Promise.all([
      fetchSeedLots(),
      fetchVarieties(),
    ])

    return <SachetsClient initialSeedLots={seedLots} varieties={varieties} />
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des sachets :{' '}
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }
}
