import { fetchAllVarieties } from './actions'
import MergeVarietesClient from '@/components/admin/MergeVarietesClient'

export const metadata = { title: 'Merge variétés — Admin' }

export default async function MergeVarietesPage() {
  try {
    const varieties = await fetchAllVarieties()
    return <MergeVarietesClient varieties={varieties} />
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}
