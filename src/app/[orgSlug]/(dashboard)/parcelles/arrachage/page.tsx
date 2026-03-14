import { fetchUprootings } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import ArrachageClient from '@/components/parcelles/ArrachageClient'

export const metadata = { title: 'Arrachage — Carnet Culture' }

export default async function ArrachagePage() {
  try {
    const [uprootings, rows, varieties] = await Promise.all([
      fetchUprootings(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
    ])

    return (
      <ArrachageClient
        initialUprootings={uprootings}
        rows={rows}
        varieties={varieties}
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
