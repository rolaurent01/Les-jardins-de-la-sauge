import { fetchHarvests, fetchLieuxSauvages } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect, fetchRowPlantings } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import CueilletteClient from '@/components/parcelles/CueilletteClient'

export const metadata = { title: 'Cueillette — Carnet Culture' }

export default async function CueillettePage() {
  try {
    const [harvests, rows, varieties, lieuxSauvages, rowPlantings] = await Promise.all([
      fetchHarvests(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
      fetchLieuxSauvages(),
      fetchRowPlantings(),
    ])

    return (
      <CueilletteClient
        initialHarvests={harvests}
        rows={rows}
        varieties={varieties}
        lieuxSauvages={lieuxSauvages}
        rowPlantings={rowPlantings}
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
