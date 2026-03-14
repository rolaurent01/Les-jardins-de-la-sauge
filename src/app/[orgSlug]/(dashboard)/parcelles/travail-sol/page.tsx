import { fetchSoilWorks } from './actions'
import { fetchRowsForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import TravailSolClient from '@/components/parcelles/TravailSolClient'

export const metadata = { title: 'Travail de sol — Carnet Culture' }

export default async function TravailSolPage() {
  try {
    const [soilWorks, rows] = await Promise.all([
      fetchSoilWorks(),
      fetchRowsForSelect(),
    ])

    return <TravailSolClient initialSoilWorks={soilWorks} rows={rows} />
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
