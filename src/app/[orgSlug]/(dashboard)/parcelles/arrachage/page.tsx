import { fetchUprootings } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect, fetchRowPlantings } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import ArrachageClient from '@/components/parcelles/ArrachageClient'

export const metadata = { title: 'Arrachage — Carnet Culture' }

export default async function ArrachagePage() {
  try {
    const [uprootings, rows, varieties, rowPlantings] = await Promise.all([
      fetchUprootings(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
      fetchRowPlantings(),
    ])

    return (
      <ArrachageClient
        initialUprootings={uprootings}
        rows={rows}
        varieties={varieties}
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
