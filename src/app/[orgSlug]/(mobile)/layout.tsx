import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import MobileShell from '@/components/mobile/MobileShell'

/**
 * Layout mobile — enveloppe toutes les pages sous /{orgSlug}/m/*.
 * Ultra-léger : pas de sidebar, pas de navigation complexe.
 * Le proxy garantit que l'utilisateur est authentifié et membre de l'org.
 */
export default async function MobileLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, cookieStore] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
  ])

  // Récupérer l'organisation
  const { data: org } = await admin
    .from('organizations')
    .select('id, nom_affiche')
    .eq('slug', orgSlug)
    .single()

  // Ferme active depuis le cookie
  const farmId = cookieStore.get('active_farm_id')?.value ?? ''

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#F9F8F6', color: '#2C3E2D' }}
    >
      {/* Header mobile */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
      >
        <span className="text-sm font-medium">
          {org?.nom_affiche ?? 'Mon Jardin'}
        </span>
        <a
          href={`/${orgSlug}/dashboard`}
          className="text-xs underline opacity-80"
        >
          Mode bureau
        </a>
      </header>

      {/* Contenu principal — wrappé dans MobileShell pour le cache + sync */}
      <main className="flex-1 flex flex-col">
        <MobileShell
          farmId={farmId}
          orgSlug={orgSlug}
          userId={user?.id ?? ''}
          organizationId={org?.id ?? ''}
        >
          {children}
        </MobileShell>
      </main>
    </div>
  )
}
