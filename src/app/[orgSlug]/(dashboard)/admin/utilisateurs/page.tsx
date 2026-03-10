import { fetchUsers, fetchOrgsWithFarms } from './actions'
import UtilisateursClient from '@/components/admin/UtilisateursClient'

export const metadata = { title: 'Utilisateurs — Admin' }

export default async function UtilisateursPage() {
  try {
    const [users, orgsWithFarms] = await Promise.all([
      fetchUsers(),
      fetchOrgsWithFarms(),
    ])
    return <UtilisateursClient initialUsers={users} orgsWithFarms={orgsWithFarms} />
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
