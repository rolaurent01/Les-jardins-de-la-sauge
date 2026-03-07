import { fetchOccultations, fetchEngraisVertNoms } from './actions'
import { fetchRowsForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import OccultationClient from '@/components/parcelles/OccultationClient'

export const metadata = { title: 'Occultation — LJS' }

export default async function OccultationPage() {
  try {
    const [occultations, rows, engraisVertNoms] = await Promise.all([
      fetchOccultations(),
      fetchRowsForSelect(),
      fetchEngraisVertNoms(),
    ])

    return (
      <OccultationClient
        initialOccultations={occultations}
        rows={rows}
        engraisVertNoms={engraisVertNoms}
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
