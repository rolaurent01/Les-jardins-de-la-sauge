import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Layout de segment dynamique [orgSlug].
 * Résout l'organisation par son slug et injecte les CSS variables de branding.
 * S'exécute en premier pour toutes les routes sous /{orgSlug}/*.
 */
export default async function OrgSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
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
