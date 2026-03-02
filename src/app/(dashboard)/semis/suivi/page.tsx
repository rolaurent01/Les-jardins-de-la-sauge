import { fetchSeedlings, fetchSeedLotsForSelect } from './actions'
import { fetchVarieties } from '@/app/(dashboard)/semis/sachets/actions'
import SemisClient from '@/components/semis/SemisClient'

export default async function SuiviSemisPage() {
  try {
    const [seedlings, seedLots, varieties] = await Promise.all([
      fetchSeedlings(),
      fetchSeedLotsForSelect(),
      fetchVarieties(),
    ])

    return (
      <SemisClient
        initialSeedlings={seedlings}
        seedLots={seedLots}
        varieties={varieties}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des semis.{' '}
          {err instanceof Error ? err.message : 'Veuillez réessayer.'}
        </p>
      </div>
    )
  }
}
