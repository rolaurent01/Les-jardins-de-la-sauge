import Link from 'next/link'

/** Actions disponibles dans la catégorie Produits */
const PRODUITS_ACTIONS = [
  { id: 'production', label: 'Production de lot', emoji: '🏭' },
]

/**
 * Page de sous-actions Produits — version statique.
 * Prend la priorité sur [category]/page.tsx pour /produits.
 */
export default async function ProduitsCategoryPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div className="flex-1 px-4 py-4">
      {/* Bouton retour + titre */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href={`/${orgSlug}/m/saisie`}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <span className="text-lg" style={{ color: '#2C3E2D' }}>←</span>
        </Link>
        <h1
          className="text-lg font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          Produits
        </h1>
      </div>

      {/* Grille de sous-actions */}
      <div className="grid grid-cols-2 gap-3">
        {PRODUITS_ACTIONS.map((action, idx) => {
          const isLast = idx === PRODUITS_ACTIONS.length - 1 && PRODUITS_ACTIONS.length % 2 !== 0
          return (
            <Link
              key={action.id}
              href={`/${orgSlug}/m/saisie/produits/${action.id}`}
              className={`
                flex flex-col items-center justify-center gap-2
                bg-white rounded-2xl
                active:scale-95 active:opacity-80
                transition-transform
                ${isLast ? 'col-span-2' : ''}
              `}
              style={{
                minHeight: '88px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <span className="text-2xl">{action.emoji}</span>
              <span
                className="text-xs font-medium text-center px-2"
                style={{ color: '#2C3E2D' }}
              >
                {action.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
