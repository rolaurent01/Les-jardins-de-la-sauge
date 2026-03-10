import Link from 'next/link'

/** Actions disponibles dans la catégorie Parcelle */
const PARCELLE_ACTIONS = [
  { id: 'travail-sol', label: 'Travail de sol', emoji: '🪓' },
  { id: 'plantation', label: 'Plantation', emoji: '🌱' },
  { id: 'suivi-rang', label: 'Suivi de rang', emoji: '🧹' },
  { id: 'cueillette', label: 'Cueillette', emoji: '✂️' },
  { id: 'arrachage', label: 'Arrachage', emoji: '🪴' },
  { id: 'occultation', label: 'Occultation', emoji: '🛡️' },
]

/**
 * Page de sous-actions Parcelle — version statique.
 * Prend la priorité sur [category]/page.tsx pour /parcelle.
 */
export default async function ParcelleCategoryPage({
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
          Parcelle
        </h1>
      </div>

      {/* Grille de sous-actions */}
      <div className="grid grid-cols-2 gap-3">
        {PARCELLE_ACTIONS.map((action, idx) => {
          const isLast = idx === PARCELLE_ACTIONS.length - 1 && PARCELLE_ACTIONS.length % 2 !== 0
          return (
            <Link
              key={action.id}
              href={`/${orgSlug}/m/saisie/parcelle/${action.id}`}
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
