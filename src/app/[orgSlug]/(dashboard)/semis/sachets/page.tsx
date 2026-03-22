import { fetchSeedLots, fetchVarieties } from './actions'
import { fetchSeedStockLevels } from '@/app/[orgSlug]/(dashboard)/stock/graines/actions'
import { getContext } from '@/lib/context'
import SachetsClient from '@/components/semis/SachetsClient'

export const metadata = { title: 'Sachets de graines — Carnet Culture' }

export default async function SachetsPage() {
  try {
    const [seedLots, varieties, ctx, seedStockLevels] = await Promise.all([
      fetchSeedLots(),
      fetchVarieties(),
      getContext(),
      fetchSeedStockLevels(),
    ])

    return <SachetsClient initialSeedLots={seedLots} varieties={varieties} certifBio={ctx.certifBio} seedStockLevels={seedStockLevels} />
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des sachets :{' '}
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }
}
