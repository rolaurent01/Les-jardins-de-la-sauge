import Link from 'next/link'

/**
 * Placeholder pour les formulaires de saisie mobile.
 * Sera remplacé par les vrais formulaires en A6.6.
 */
export default async function MobileActionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; category: string; action: string }>
}) {
  const { orgSlug, category, action } = await params

  // Titre lisible : remplace les tirets par des espaces
  const actionLabel = action
    .replace(/-/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div className="flex-1 px-4 py-4">
      {/* Bouton retour */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/${orgSlug}/m/saisie/${category}`}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <span className="text-lg" style={{ color: '#2C3E2D' }}>←</span>
        </Link>
        <h1
          className="text-lg font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          {actionLabel}
        </h1>
      </div>

      {/* Placeholder */}
      <div
        className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl bg-white"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <p className="text-sm" style={{ color: '#999' }}>
          Formulaire à venir (A6.6)
        </p>
      </div>
    </div>
  )
}
