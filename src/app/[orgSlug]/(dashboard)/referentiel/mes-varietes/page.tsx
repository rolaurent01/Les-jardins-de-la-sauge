import { fetchVarietiesWithSettings, hasExistingSettings } from './actions'
import MesVarietesClient from '@/components/referentiel/MesVarietesClient'

export const metadata = { title: 'Mes variétés — Carnet Culture' }

export default async function MesVarietesPage() {
  try {
    const [varieties, hasSettings] = await Promise.all([
      fetchVarietiesWithSettings(),
      hasExistingSettings(),
    ])

    return (
      <MesVarietesClient
        initialVarieties={varieties}
        initialHasSettings={hasSettings}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}
