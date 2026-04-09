import { fetchPlantings, fetchSeedlingsForSelect, fetchSeedLotsForSelect } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import { getContext } from '@/lib/context'
import PlantationsClient from '@/components/parcelles/PlantationsClient'

export const metadata = { title: 'Plantations — Carnet Culture' }

export default async function PlantationsPage() {
  try {
    const [plantings, rows, varieties, seedlings, seedLots, ctx] = await Promise.all([
      fetchPlantings(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
      fetchSeedlingsForSelect(),
      fetchSeedLotsForSelect(),
      getContext(),
    ])

    return (
      <PlantationsClient
        initialPlantings={plantings}
        rows={rows}
        varieties={varieties}
        seedlings={seedlings}
        seedLots={seedLots}
        certifBio={ctx.certifBio}
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
