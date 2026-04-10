import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { getUnreadChangelogCount, getUnreadTicketReplyCount } from './assistance/actions'
import { getNewTicketCount } from './admin/feedbacks/actions'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'
import ImpersonationBanner from '@/components/admin/ImpersonationBanner'
import MobileDesktopBanner from '@/components/layout/MobileDesktopBanner'

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
        .select('id, nom, slug, certif_bio')
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

  // Charger toutes les organisations si super admin (pour le sélecteur d'org)
  let allOrganizations: { slug: string; nom: string }[] = []
  if (isAdmin) {
    const { data: orgs } = await admin
      .from('organizations')
      .select('slug, nom')
      .order('nom')
    allOrganizations = orgs ?? []
  }

  // Compter les notifications sidebar
  const [unreadChangelog, unreadTicketReplies, newTicketCount] = await Promise.all([
    user ? getUnreadChangelogCount() : Promise.resolve(0),
    user ? getUnreadTicketReplyCount() : Promise.resolve(0),
    isAdmin ? getNewTicketCount() : Promise.resolve(0),
  ])

  // Vérifier le mode impersonation
  const impersonateFarmId = cookieStore.get('impersonate_farm_id')?.value
  let impersonationFarmName: string | null = null
  if (impersonateFarmId && isAdmin) {
    const { data: impFarm } = await admin
      .from('farms')
      .select('nom')
      .eq('id', impersonateFarmId)
      .single()
    impersonationFarmName = impFarm?.nom ?? null
  }

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
          allOrganizations={allOrganizations}
          unreadChangelog={unreadChangelog}
          unreadTicketReplies={unreadTicketReplies}
          newTicketCount={newTicketCount}
        />
      </div>

      {/* Zone de contenu principale */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Bandeau d'impersonation — visible sur TOUTES les pages */}
        {impersonationFarmName && (
          <ImpersonationBanner
            farmName={impersonationFarmName}
            orgSlug={orgSlug}
          />
        )}

        {/* Bandeau "passer en mode terrain" — visible sur petit écran */}
        <MobileDesktopBanner orgSlug={orgSlug} />

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
