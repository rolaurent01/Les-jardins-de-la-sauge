import { fetchHarvests, fetchLieuxSauvages } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import CueilletteClient from '@/components/parcelles/CueilletteClient'

export const metadata = { title: 'Cueillette — Carnet Culture' }

export default async function CueillettePage() {
  try {
    const [harvests, rows, varieties, lieuxSauvages] = await Promise.all([
      fetchHarvests(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
      fetchLieuxSauvages(),
    ])

    return (
      <CueilletteClient
        initialHarvests={harvests}
        rows={rows}
        varieties={varieties}
        lieuxSauvages={lieuxSauvages}
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
