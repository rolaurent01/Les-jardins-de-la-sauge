import { getBackupStatus, fetchOrgsWithFarms, getImpersonationStatus, fetchFarms } from './actions'
import OutilsClient from '@/components/admin/OutilsClient'

export const metadata = { title: 'Outils — Admin' }

export default async function OutilsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  try {
    const { orgSlug } = await params
    const [backups, orgsWithFarms, impersonation, farms] = await Promise.all([
      getBackupStatus(),
      fetchOrgsWithFarms(),
      getImpersonationStatus(),
      fetchFarms(),
    ])

    return (
      <OutilsClient
        orgSlug={orgSlug}
        backups={backups}
        orgsWithFarms={orgsWithFarms}
        impersonation={impersonation}
        farms={farms}
      />
    )
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
