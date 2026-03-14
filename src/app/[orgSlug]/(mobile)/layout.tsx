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
        .select('id, nom, certif_bio')
        .eq('organization_id', org.id)
        .order('nom')
    : { data: [] }

  const farmList = farms ?? []

  // Ferme active depuis le cookie, sinon la première
  const farmId = cookieStore.get('active_farm_id')?.value
    ?? (farmList.length > 0 ? farmList[0].id : '')

  // Résoudre certif_bio de la ferme active
  const activeFarm = farmList.find(f => f.id === farmId)
  const certifBio = activeFarm?.certif_bio ?? false

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
          {certifBio && (
            <span
              className="shrink-0 rounded-full text-[10px] font-semibold"
              style={{ padding: '1px 8px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              Bio
            </span>
          )}
        </div>
        <a
          href={`/${orgSlug}/dashboard?desktop=1`}
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
          certifBio={certifBio}
        >
          {children}
        </MobileShell>
      </main>
    </div>
  )
}
