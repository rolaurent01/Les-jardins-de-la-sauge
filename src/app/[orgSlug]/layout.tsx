import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Layout de segment dynamique [orgSlug].
 * Résout l'organisation par son slug et injecte les CSS variables de branding.
 * S'exécute en premier pour toutes les routes sous /{orgSlug}/*.
 *
 * Utilise le client admin car auth.uid() peut être NULL dans les Server Components
 * lors du premier rendu après login. Le proxy a déjà vérifié l'authentification
 * et l'appartenance à l'organisation.
 */
export default async function OrgSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, slug, nom_affiche, logo_url, couleur_primaire, couleur_secondaire')
    .eq('slug', orgSlug)
    .single()

  if (!org) notFound()

  const primary = org.couleur_primaire || '#3A5A40'
  const secondary = org.couleur_secondaire || '#588157'

  return (
    <div
      style={{
        '--color-primary': primary,
        '--color-primary-light': secondary,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
