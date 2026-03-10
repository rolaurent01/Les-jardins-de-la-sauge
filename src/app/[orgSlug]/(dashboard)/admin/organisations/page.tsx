import { fetchOrganizations } from './actions'
import OrganisationsClient from '@/components/admin/OrganisationsClient'

export const metadata = { title: 'Organisations — Admin' }

export default async function OrganisationsPage() {
  try {
    const organizations = await fetchOrganizations()
    return <OrganisationsClient initialOrganizations={organizations} />
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
