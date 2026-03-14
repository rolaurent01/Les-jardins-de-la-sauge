import type { Variety } from '@/lib/types'
import { fetchVarieties } from './actions'
import VarietesClient from '@/components/referentiel/VarietesClient'

export const metadata = { title: 'Variétés — Carnet Culture' }

export default async function VarietesPage() {
  let varieties: Variety[]

  try {
    varieties = await fetchVarieties()
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des variétés : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }

  return <VarietesClient initialVarieties={varieties} />
}
