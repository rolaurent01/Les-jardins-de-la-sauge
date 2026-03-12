import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import MobileShell from '@/components/mobile/MobileShell'
import MobileFarmSelector from '@/components/mobile/MobileFarmSelector'

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

  // Charger les fermes accessibles (pour le sélecteur mobile)
  const { data: farms } = org
    ? await admin
        .from('farms')
        .select('id, nom')
        .eq('organization_id', org.id)
        .order('nom')
    : { data: [] }

  const farmList = farms ?? []

  // Ferme active depuis le cookie, sinon la première
  const farmId = cookieStore.get('active_farm_id')?.value
    ?? (farmList.length > 0 ? farmList[0].id : '')

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
        {/* Nom de l'org + sélecteur de ferme */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium shrink-0">
            {org?.nom_affiche ?? 'Mon Jardin'}
          </span>
          <MobileFarmSelector
            farms={farmList}
            activeFarmId={farmId}
          />
        </div>
        <a
          href={`/${orgSlug}/dashboard`}
          className="text-xs underline opacity-80 shrink-0 ml-2"
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
