import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'

/**
 * Layout bureau — wraps toutes les pages authentifiées.
 * Le middleware garantit qu'on n'arrive ici que si l'utilisateur est connecté.
 * Sur mobile (< md) : sidebar cachée, MobileHeader avec drawer à la place.
 * Sur desktop (≥ md) : sidebar fixe à gauche, MobileHeader masqué.
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
      {/* Sidebar — cachée sur mobile, visible à partir de md */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar userEmail={user?.email} />
      </div>

      {/* Zone de contenu principale */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Barre top mobile — visible uniquement sur mobile */}
        <div className="md:hidden flex-shrink-0">
          <MobileHeader userEmail={user?.email} />
        </div>

        {children}
      </main>
    </div>
  )
}
