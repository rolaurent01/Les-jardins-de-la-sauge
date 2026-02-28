import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

/**
 * Layout bureau — wraps toutes les pages authentifiées.
 * Le middleware garantit qu'on n'arrive ici que si l'utilisateur est connecté.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F9F8F6' }}>
      <Sidebar userEmail={user?.email} />

      {/* Zone de contenu principale */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
