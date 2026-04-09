import { getAllChangelogEntries } from './actions'
import ChangelogAdminClient from '@/components/admin/ChangelogAdminClient'

export const metadata = { title: 'Changelog — Admin' }

export default async function ChangelogAdminPage() {
  try {
    const entries = await getAllChangelogEntries()
    return <ChangelogAdminClient initialEntries={entries} />
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
