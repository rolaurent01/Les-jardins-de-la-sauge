import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import AdminNav from '@/components/admin/AdminNav'

/**
 * Layout admin — enveloppe toutes les pages d'administration plateforme.
 * Double sécurité : le proxy vérifie déjà, mais on re-vérifie côté serveur.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isPlatformAdmin(user.id))) {
    redirect(`/${orgSlug}/dashboard`)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bandeau admin distinctif */}
      <div
        className="flex-shrink-0 px-6 py-2.5 flex items-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 100%)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontSize: '15px' }}>&#x1F527;</span>
        <span>Administration plateforme</span>
      </div>

      {/* Sous-navigation admin */}
      <AdminNav orgSlug={orgSlug} />

      {/* Contenu de la page admin */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
