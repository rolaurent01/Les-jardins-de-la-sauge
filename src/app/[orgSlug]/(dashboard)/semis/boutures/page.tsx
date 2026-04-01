import { fetchCuttings } from './actions'
import { fetchVarieties } from '@/app/[orgSlug]/(dashboard)/semis/sachets/actions'
import BouturesClient from '@/components/semis/BouturesClient'

export default async function BouturesPage() {
  try {
    const [cuttings, varieties] = await Promise.all([
      fetchCuttings(),
      fetchVarieties(),
    ])

    return (
      <BouturesClient
        initialCuttings={cuttings}
        varieties={varieties}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des boutures.{' '}
          {err instanceof Error ? err.message : 'Veuillez réessayer.'}
        </p>
      </div>
    )
  }
}
