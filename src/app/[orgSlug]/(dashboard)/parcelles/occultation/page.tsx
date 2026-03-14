import { fetchOccultations, fetchEngraisVertNoms } from './actions'
import { fetchRowsForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import { getContext } from '@/lib/context'
import OccultationClient from '@/components/parcelles/OccultationClient'

export const metadata = { title: 'Occultation — Carnet Culture' }

export default async function OccultationPage() {
  try {
    const [occultations, rows, engraisVertNoms, ctx] = await Promise.all([
      fetchOccultations(),
      fetchRowsForSelect(),
      fetchEngraisVertNoms(),
      getContext(),
    ])

    return (
      <OccultationClient
        initialOccultations={occultations}
        rows={rows}
        engraisVertNoms={engraisVertNoms}
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
