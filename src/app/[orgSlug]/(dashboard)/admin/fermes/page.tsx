import { fetchFarms, fetchOrganizationsForSelect } from './actions'
import FermesClient from '@/components/admin/FermesClient'

export const metadata = { title: 'Fermes — Admin' }

export default async function FermesPage() {
  try {
    const [farms, organizations] = await Promise.all([
      fetchFarms(),
      fetchOrganizationsForSelect(),
    ])
    return <FermesClient initialFarms={farms} organizations={organizations} />
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
