import { fetchPlantings, fetchSeedlingsForSelect } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import PlantationsClient from '@/components/parcelles/PlantationsClient'

export const metadata = { title: 'Plantations — LJS' }

export default async function PlantationsPage() {
  try {
    const [plantings, rows, varieties, seedlings] = await Promise.all([
      fetchPlantings(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
      fetchSeedlingsForSelect(),
    ])

    return (
      <PlantationsClient
        initialPlantings={plantings}
        rows={rows}
        varieties={varieties}
        seedlings={seedlings}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement :{' '}
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }
}
