import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'

/**
 * Layout bureau — wraps toutes les pages authentifiées.
 * Le proxy garantit qu'on n'arrive ici que si l'utilisateur est connecté.
 * Sur mobile (< md) : sidebar cachée, MobileHeader avec drawer à la place.
 * Sur desktop (≥ md) : sidebar fixe à gauche, MobileHeader masqué.
 *
 * getUser() utilise le client SSR (cookies). Les requêtes DB utilisent le
 * client admin car auth.uid() peut être NULL dans les Server Components
 * lors du premier rendu après login (limitation @supabase/ssr).
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: { user } },
    cookieStore,
  ] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
  ])

  // Récupérer l'organisation et ses fermes accessibles (admin bypass RLS)
  const { data: org } = await admin
    .from('organizations')
    .select('id, nom_affiche, logo_url')
    .eq('slug', orgSlug)
    .single()

  const { data: farms } = org
    ? await admin
        .from('farms')
        .select('id, nom, slug')
        .eq('organization_id', org.id)
        .order('nom')
    : { data: [] }

  // Ferme active depuis le cookie, sinon la première
  const activeFarmId =
    cookieStore.get('active_farm_id')?.value ??
    (farms && farms.length > 0 ? farms[0].id : '')

  const organization = {
    nom_affiche: org?.nom_affiche ?? null,
    logo_url: org?.logo_url ?? null,
  }

  const farmList = farms ?? []

  // Vérifier si l'utilisateur est super admin plateforme
  const isAdmin = user ? await isPlatformAdmin(user.id) : false

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F9F8F6' }}>
      {/* Sidebar — cachée sur mobile, visible à partir de md */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar
          userEmail={user?.email}
          organization={organization}
          farms={farmList}
          activeFarmId={activeFarmId}
          orgSlug={orgSlug}
          isPlatformAdmin={isAdmin}
        />
      </div>

      {/* Zone de contenu principale */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Barre top mobile — visible uniquement sur mobile */}
        <div className="md:hidden flex-shrink-0">
          <MobileHeader
            userEmail={user?.email}
            organization={organization}
            farms={farmList}
            activeFarmId={activeFarmId}
            orgSlug={orgSlug}
          />
        </div>

        {children}
      </main>
    </div>
  )
}
